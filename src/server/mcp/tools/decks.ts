import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Card } from "../../../shared/types/card.js";
import type { SavedDeck, DeckCard } from "../../../shared/types/deck.js";
import {
  listDecks,
  getDeck,
  createDeck,
  updateDeck,
  deleteDeck,
  copyDeck,
  searchDecks,
} from "../../services/deck-store.js";
import { getCard, getVariants, ensureCardLoaded, findCardBySetAndNumber } from "../../services/card-store.js";
import { parsePtcgoText } from "../../services/limitless.js";
import { resolveDecklist } from "../../services/decklist-resolve.js";
import { beautifyDeckCards } from "../../services/deck-beautify.js";
import { logAction } from "../../services/logger.js";
import { checkDeckLegality } from "../../../shared/utils/deck-legality.js";
import { makeRng } from "../../../shared/utils/hand-sim.js";
import { isValidCardId } from "../../../shared/validation.js";
import { asJson } from "../util.js";
import { effectiveUserId, fail, type McpContext, type Resolved } from "../context.js";

/**
 * Deck tools: everything the Deck view can do, callable from a remote Claude.
 *
 * Identity: every tool takes an optional `actAsUserId` (admins only) that
 * mirrors the REST `X-Act-As-User` header. Cards are addressed by DecklistGen
 * card id (e.g. "sv06.5-036" — what search_cards returns); "SET LOCALID" pairs
 * are accepted too.
 */

const actAs = z
  .string()
  .optional()
  .describe("Admin only: operate on this user's decks instead of your own (see list_users).");

const cardRef = z.string().describe('Card id like "sv06.5-036", or "SETCODE LOCALID" like "PAF 54".');

const cardEntry = z.object({
  cardId: cardRef,
  count: z.number().int().min(1).max(60).default(1),
});

// --- helpers -----------------------------------------------------------------

async function resolveCard(ref: string): Promise<Card | null> {
  const trimmed = ref.trim();
  if (isValidCardId(trimmed)) {
    await ensureCardLoaded(trimmed);
    const c = getCard(trimmed);
    if (c) return c;
  }
  const m = /^([0-9A-Za-z.]+)[\s-]+([0-9A-Za-z]+)$/.exec(trimmed);
  if (m) return findCardBySetAndNumber(m[1], m[2]) ?? null;
  return null;
}

function entryKey(c: { setCode: string; localId: string }): string {
  return `${c.setCode}\0${c.localId}`;
}

function compactEntry(e: DeckCard) {
  const c = e.card;
  return {
    cardId: c.id,
    name: c.name,
    set: c.setCode,
    localId: c.localId,
    count: e.count,
    category: c.category,
    trainerType: c.trainerType,
    stage: c.stage,
    rarity: c.rarity,
    energyTypes: c.energyTypes,
    ...(e.artCard ? { artCardId: e.artCard.id } : {}),
  };
}

function summarize(cards: DeckCard[]) {
  const by = { pokemon: 0, trainer: 0, energy: 0 };
  let total = 0;
  for (const e of cards) {
    total += e.count;
    if (e.card.category === "Pokemon") by.pokemon += e.count;
    else if (e.card.category === "Trainer") by.trainer += e.count;
    else by.energy += e.count;
  }
  return { total, ...by, unique: cards.length };
}

export function deckView(deck: SavedDeck, full = false) {
  return {
    id: deck.id,
    name: deck.name,
    isPublic: deck.isPublic ?? false,
    isListed: deck.isListed ?? false,
    importSource: deck.importSource,
    createdAt: deck.createdAt,
    updatedAt: deck.updatedAt,
    summary: summarize(deck.cards),
    legality: checkDeckLegality(deck.cards),
    cards: full ? deck.cards : deck.cards.map(compactEntry),
  };
}

async function loadOwnDeck(ctx: McpContext, deckId: string, actAsUserId?: string): Promise<Resolved<{ userId: string; deck: SavedDeck }>> {
  const u = effectiveUserId(ctx, actAsUserId);
  if (!u.ok) return u;
  const deck = await getDeck(deckId, u.value);
  if (!deck) return { ok: false, result: fail(`Deck not found: ${deckId}`) };
  return { ok: true, value: { userId: u.value, deck } };
}

/** Rows whose count or art override changed between two card lists; removed rows come back with count 0. */
export function diffDeckCards(before: DeckCard[], after: DeckCard[]) {
  const key = (e: DeckCard) => `${e.card.setCode}\0${e.card.localId}`;
  const prev = new Map(before.map((e) => [key(e), e]));
  const next = new Map(after.map((e) => [key(e), e]));
  const changed: Array<ReturnType<typeof compactEntry> & { previousCount: number }> = [];
  for (const [k, e] of next) {
    const p = prev.get(k);
    if (!p || p.count !== e.count || (p.artCard?.id ?? null) !== (e.artCard?.id ?? null)) {
      changed.push({ ...compactEntry(e), previousCount: p?.count ?? 0 });
    }
  }
  for (const [k, p] of prev) {
    if (!next.has(k)) changed.push({ ...compactEntry({ ...p, count: 0 }), previousCount: p.count });
  }
  return changed;
}

/**
 * Per-deck mutation lock. Each mutation is a read-modify-write with awaits in
 * the middle (card resolution), so two parallel calls on the same deck would
 * otherwise race and the second save would silently drop the first edit.
 */
const deckLocks = new Map<string, Promise<unknown>>();
async function withDeckLock<T>(deckId: string, fn: () => Promise<T>): Promise<T> {
  const prev = deckLocks.get(deckId) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  deckLocks.set(deckId, run.catch(() => undefined));
  try {
    return await run;
  } finally {
    if (deckLocks.get(deckId) === run.catch(() => undefined)) deckLocks.delete(deckId);
  }
}

const verboseArg = z
  .boolean()
  .default(false)
  .describe("true returns the whole deck after the edit; false (default) returns summary, legality and only the changed rows.");

async function saveCards(
  deckId: string,
  userId: string,
  before: DeckCard[],
  cards: DeckCard[],
  verbose: boolean,
  action: string,
  data: Record<string, unknown>,
): Promise<CallToolResult> {
  const updated = await updateDeck(deckId, userId, { cards });
  if (!updated) return fail("Deck not found or not yours (public decks are read-only — copy it first)");
  logAction(action, "mcp", { deckId, ...data });
  if (verbose) return asJson(deckView(updated));
  return asJson({
    id: updated.id,
    name: updated.name,
    updatedAt: updated.updatedAt,
    summary: summarize(updated.cards),
    legality: checkDeckLegality(updated.cards),
    changed: diffDeckCards(before, updated.cards),
  });
}

/**
 * One mutation on a card list. `mutate*` tools and `edit_deck` both go through
 * here so a batch and a single call can't drift apart.
 */
export type DeckOp =
  | { op: "add"; cardId: string; count?: number }
  | { op: "remove"; cardId: string; count?: number }
  | { op: "set"; cardId: string; count: number }
  | { op: "swap"; fromCardId: string; toCardId: string; count?: number; allowDifferentCard?: boolean }
  | { op: "art"; cardId: string; artCardId: string | null };

function findIn(cards: DeckCard[], card: Card): DeckCard | undefined {
  return cards.find((e) => e.card.id === card.id || entryKey(e.card) === entryKey(card));
}

async function applyOp(cards: DeckCard[], op: DeckOp): Promise<Resolved<DeckCard[]>> {
  const next = cards.map((c) => ({ ...c }));
  switch (op.op) {
    case "add": {
      const card = await resolveCard(op.cardId);
      if (!card) return { ok: false, result: fail(`Unknown card: ${op.cardId}`) };
      const e = findIn(next, card);
      if (e) e.count += op.count ?? 1;
      else next.push({ count: op.count ?? 1, card });
      return { ok: true, value: next };
    }
    case "remove": {
      const card = await resolveCard(op.cardId);
      const e = card ? findIn(next, card) : undefined;
      if (!e) return { ok: false, result: fail(`Not in deck: ${op.cardId}`) };
      e.count = op.count === undefined ? 0 : Math.max(0, e.count - op.count);
      return { ok: true, value: next.filter((x) => x.count > 0) };
    }
    case "set": {
      const card = await resolveCard(op.cardId);
      if (!card) return { ok: false, result: fail(`Unknown card: ${op.cardId}`) };
      const e = findIn(next, card);
      if (e) e.count = op.count;
      else if (op.count > 0) next.push({ count: op.count, card });
      return { ok: true, value: next.filter((x) => x.count > 0) };
    }
    case "swap": {
      const [from, to] = await Promise.all([resolveCard(op.fromCardId), resolveCard(op.toCardId)]);
      if (!from) return { ok: false, result: fail(`Unknown card: ${op.fromCardId}`) };
      if (!to) return { ok: false, result: fail(`Unknown card: ${op.toCardId}`) };
      if (!op.allowDifferentCard && !sameCard(from, to)) {
        return { ok: false, result: fail(`${to.name} (${to.id}) is not a printing of ${from.name} (${from.id}). Pass allowDifferentCard=true to substitute anyway.`) };
      }
      const src = findIn(next, from);
      if (!src) return { ok: false, result: fail(`${from.name} (${from.id}) is not in the deck`) };
      const moving = op.count === undefined ? src.count : Math.min(op.count, src.count);
      src.count -= moving;
      const dst = findIn(next, to);
      if (dst) dst.count += moving;
      else next.push({ count: moving, card: to });
      return { ok: true, value: next.filter((x) => x.count > 0) };
    }
    case "art": {
      const card = await resolveCard(op.cardId);
      if (!card) return { ok: false, result: fail(`Unknown card: ${op.cardId}`) };
      const art = op.artCardId ? await resolveCard(op.artCardId) : null;
      if (op.artCardId && !art) return { ok: false, result: fail(`Unknown card: ${op.artCardId}`) };
      const e = findIn(next, card);
      if (!e) return { ok: false, result: fail(`${card.name} (${card.id}) is not in the deck`) };
      if (art) e.artCard = art;
      else delete e.artCard;
      return { ok: true, value: next };
    }
  }
}

/** Load the deck under its lock, apply ops in order, save once. Any failing op aborts the whole batch unsaved. */
async function mutate(
  ctx: McpContext,
  deckId: string,
  actAsUserId: string | undefined,
  ops: DeckOp[],
  verbose: boolean,
  action: string,
  data: Record<string, unknown>,
): Promise<CallToolResult> {
  return withDeckLock(deckId, async () => {
    const r = await loadOwnDeck(ctx, deckId, actAsUserId);
    if (!r.ok) return r.result;
    let cards = r.value.deck.cards;
    for (let i = 0; i < ops.length; i++) {
      const applied = await applyOp(cards, ops[i]);
      if (!applied.ok) {
        if (ops.length === 1) return applied.result;
        const inner = JSON.parse((applied.result.content[0] as { text: string }).text) as { error: string };
        return fail(`Op ${i + 1} of ${ops.length} (${ops[i].op}) failed, nothing saved: ${inner.error}`);
      }
      cards = applied.value;
    }
    return saveCards(deckId, r.value.userId, r.value.deck.cards, cards, verbose, action, data);
  });
}

async function resolveEntries(entries: Array<{ cardId: string; count: number }>): Promise<Resolved<DeckCard[]>> {
  const out: DeckCard[] = [];
  const missing: string[] = [];
  for (const e of entries) {
    const card = await resolveCard(e.cardId);
    if (!card) missing.push(e.cardId);
    else out.push({ count: e.count, card });
  }
  if (missing.length) return { ok: false, result: fail(`Unknown card(s): ${missing.join(", ")}. Use search_cards to find ids; sets may need load_set first.`) };
  return { ok: true, value: out };
}

function sameCard(a: Card, b: Card): boolean {
  if (a.category === "Energy" && b.category === "Energy" && a.mechanicsHash === "basic" && b.mechanicsHash === "basic") {
    return a.energyTypes[0] === b.energyTypes[0];
  }
  return a.name === b.name && a.mechanicsHash === b.mechanicsHash;
}

// --- tools -----------------------------------------------------------------

export function registerDeckTools(server: McpServer, ctx: McpContext): void {
  server.registerTool(
    "list_decks",
    {
      title: "List saved decks",
      description: "List the saved decks of the authenticated user (or, for admins, of actAsUserId). Summaries only — call get_deck for cards.",
      inputSchema: { actAsUserId: actAs },
    },
    async ({ actAsUserId }) => {
      const u = effectiveUserId(ctx, actAsUserId);
      if (!u.ok) return u.result;
      const decks = await listDecks(u.value);
      return asJson({ userId: u.value, decks, total: decks.length });
    },
  );

  server.registerTool(
    "find_decks",
    {
      title: "Find decks by name",
      description:
        "Case-insensitive substring search over deck names. Searches your own decks; admins may pass " +
        "allUsers=true to search every account (results include the owner) — the way to locate a player's deck.",
      inputSchema: {
        query: z.string().min(1),
        allUsers: z.boolean().default(false),
        actAsUserId: actAs,
      },
    },
    async ({ query, allUsers, actAsUserId }) => {
      const u = effectiveUserId(ctx, actAsUserId);
      if (!u.ok) return u.result;
      if (allUsers && !ctx.user!.isAdmin) return fail("Admin access required to search all users' decks");
      const decks = await searchDecks(query, allUsers ? undefined : u.value);
      return asJson({ decks, total: decks.length });
    },
  );

  server.registerTool(
    "get_deck",
    {
      title: "Get a saved deck",
      description:
        "Full contents of one of your decks (or a public deck): per-printing entries with counts, a category " +
        "summary, and legality issues. full=true returns the raw Card objects instead of the compact rows.",
      inputSchema: { deckId: z.string(), full: z.boolean().default(false), actAsUserId: actAs },
    },
    async ({ deckId, full, actAsUserId }) => {
      const r = await loadOwnDeck(ctx, deckId, actAsUserId);
      if (!r.ok) return r.result;
      return asJson(deckView(r.value.deck, full));
    },
  );

  server.registerTool(
    "create_deck",
    {
      title: "Create a deck",
      description:
        "Create a new saved deck. Seed it with `cards` (id + count), with `decklistText` in PTCGO/PTCGL format " +
        "('4 Charizard ex PAF 54' lines), or leave it empty. Returns the new deck plus any unresolved text lines.",
      inputSchema: {
        name: z.string().min(1).max(120),
        cards: z.array(cardEntry).optional(),
        decklistText: z.string().optional(),
        actAsUserId: actAs,
      },
    },
    async ({ name, cards, decklistText, actAsUserId }) => {
      const u = effectiveUserId(ctx, actAsUserId);
      if (!u.ok) return u.result;
      let entries: DeckCard[] = [];
      let unresolved: unknown[] = [];
      if (cards?.length) {
        const r = await resolveEntries(cards);
        if (!r.ok) return r.result;
        entries = r.value;
      }
      if (decklistText?.trim()) {
        const parsed = await resolveDecklist(parsePtcgoText(decklistText));
        entries.push(...parsed.cards.map((c) => ({ count: c.count, card: c.card })));
        unresolved = parsed.unresolved;
      }
      const now = new Date().toISOString();
      const deck: SavedDeck = {
        id: crypto.randomUUID(),
        name: name.trim(),
        cards: entries,
        createdAt: now,
        updatedAt: now,
        ...(decklistText ? { importedAt: now, importSource: "mcp:text" } : {}),
      };
      await createDeck(u.value, deck);
      // Re-read so consolidation (merged duplicate printings) is reflected.
      const saved = (await updateDeck(deck.id, u.value, { cards: entries })) ?? deck;
      logAction("deck.create", "mcp", { deckName: deck.name, cardCount: entries.length, via: "mcp" });
      return asJson({ ...deckView(saved), unresolved });
    },
  );

  server.registerTool(
    "rename_deck",
    {
      title: "Rename a deck",
      description: "Change a deck's name.",
      inputSchema: { deckId: z.string(), name: z.string().min(1).max(120), actAsUserId: actAs },
    },
    async ({ deckId, name, actAsUserId }) => {
      const u = effectiveUserId(ctx, actAsUserId);
      if (!u.ok) return u.result;
      const updated = await updateDeck(deckId, u.value, { name: name.trim() });
      if (!updated) return fail(`Deck not found: ${deckId}`);
      logAction("deck.update", "mcp", { deckId, rename: true });
      return asJson(deckView(updated));
    },
  );

  server.registerTool(
    "delete_deck",
    {
      title: "Delete a deck",
      description: "Permanently delete one of your decks. Irreversible — confirm with the user first.",
      inputSchema: { deckId: z.string(), actAsUserId: actAs },
    },
    async ({ deckId, actAsUserId }) => {
      const u = effectiveUserId(ctx, actAsUserId);
      if (!u.ok) return u.result;
      const ok = await deleteDeck(deckId, u.value);
      if (!ok) return fail(`Deck not found: ${deckId}`);
      logAction("deck.delete", "mcp", { deckId });
      return asJson({ ok: true, deckId });
    },
  );

  server.registerTool(
    "copy_deck",
    {
      title: "Copy a deck",
      description: "Duplicate one of your decks (or any public deck) into your account. Defaults to '<name> (Copy)'.",
      inputSchema: { deckId: z.string(), name: z.string().optional(), actAsUserId: actAs },
    },
    async ({ deckId, name, actAsUserId }) => {
      const u = effectiveUserId(ctx, actAsUserId);
      if (!u.ok) return u.result;
      const original = await getDeck(deckId, u.value);
      if (!original) return fail(`Deck not found: ${deckId}`);
      const copy = await copyDeck(deckId, u.value, name?.trim() || `${original.name} (Copy)`);
      if (!copy) return fail("Copy failed");
      logAction("deck.copy", "mcp", { deckId, newName: copy.name });
      return asJson(deckView(copy));
    },
  );

  server.registerTool(
    "set_deck_visibility",
    {
      title: "Set deck visibility",
      description: "Make a deck public (shareable by link) and/or listed in the public gallery. Listed implies public.",
      inputSchema: {
        deckId: z.string(),
        isPublic: z.boolean().optional(),
        isListed: z.boolean().optional(),
        actAsUserId: actAs,
      },
    },
    async ({ deckId, isPublic, isListed, actAsUserId }) => {
      const u = effectiveUserId(ctx, actAsUserId);
      if (!u.ok) return u.result;
      const updates: Partial<SavedDeck> = {};
      if (isPublic !== undefined) updates.isPublic = isPublic;
      if (isListed !== undefined) updates.isListed = isListed;
      if (updates.isListed && updates.isPublic === undefined) updates.isPublic = true;
      const updated = await updateDeck(deckId, u.value, updates);
      if (!updated) return fail(`Deck not found: ${deckId}`);
      logAction("deck.visibility", "mcp", { deckId, isPublic: updated.isPublic, isListed: updated.isListed });
      return asJson(deckView(updated));
    },
  );

  server.registerTool(
    "add_cards",
    {
      title: "Add cards to a deck",
      description: "Add copies of one or more printings. Existing stacks of the same printing are incremented.",
      inputSchema: { deckId: z.string(), cards: z.array(cardEntry).min(1), verbose: verboseArg, actAsUserId: actAs },
    },
    async ({ deckId, cards, verbose, actAsUserId }) =>
      mutate(ctx, deckId, actAsUserId, cards.map((c) => ({ op: "add" as const, ...c })), verbose, "deck.update", { add: cards }),
  );

  server.registerTool(
    "remove_cards",
    {
      title: "Remove cards from a deck",
      description: "Remove copies of one or more printings. Omit `count` on an entry to remove every copy of that printing.",
      inputSchema: {
        deckId: z.string(),
        cards: z.array(z.object({ cardId: cardRef, count: z.number().int().min(1).optional() })).min(1),
        verbose: verboseArg,
        actAsUserId: actAs,
      },
    },
    async ({ deckId, cards, verbose, actAsUserId }) =>
      mutate(ctx, deckId, actAsUserId, cards.map((c) => ({ op: "remove" as const, ...c })), verbose, "deck.update", { remove: cards }),
  );

  server.registerTool(
    "set_card_count",
    {
      title: "Set a printing's copy count",
      description: "Set the exact number of copies of a printing (0 removes it; adds it if absent).",
      inputSchema: { deckId: z.string(), cardId: cardRef, count: z.number().int().min(0).max(60), verbose: verboseArg, actAsUserId: actAs },
    },
    async ({ deckId, cardId, count, verbose, actAsUserId }) =>
      mutate(ctx, deckId, actAsUserId, [{ op: "set", cardId, count }], verbose, "deck.update", { setCount: { cardId, count } }),
  );

  server.registerTool(
    "swap_card_printing",
    {
      title: "Swap a printing for another",
      description:
        "Move copies of one printing onto another printing of the same card (a different art / set). " +
        "Omit `count` to move every copy; give a count to change just some instances. By default the target " +
        "must be the same card (same name + rules text; any basic energy of the same type); set " +
        "allowDifferentCard=true to substitute a genuinely different card. Use get_card_variants to list options.",
      inputSchema: {
        deckId: z.string(),
        fromCardId: cardRef,
        toCardId: cardRef,
        count: z.number().int().min(1).optional(),
        allowDifferentCard: z.boolean().default(false),
        verbose: verboseArg,
        actAsUserId: actAs,
      },
    },
    async ({ deckId, fromCardId, toCardId, count, allowDifferentCard, verbose, actAsUserId }) =>
      mutate(ctx, deckId, actAsUserId, [{ op: "swap", fromCardId, toCardId, count, allowDifferentCard }], verbose, "deck.update", {
        swap: { fromCardId, toCardId, count },
      }),
  );

  server.registerTool(
    "set_card_art",
    {
      title: "Override a printing's artwork",
      description:
        "Set (or clear, with artCardId=null) the art override on a deck entry: the entry keeps its printing but renders " +
        "with another variant's artwork. Most of the time swap_card_printing is what you want instead.",
      inputSchema: { deckId: z.string(), cardId: cardRef, artCardId: cardRef.nullable(), verbose: verboseArg, actAsUserId: actAs },
    },
    async ({ deckId, cardId, artCardId, verbose, actAsUserId }) =>
      mutate(ctx, deckId, actAsUserId, [{ op: "art", cardId, artCardId }], verbose, "deck.update", { setArt: { cardId, artCardId } }),
  );

  server.registerTool(
    "edit_deck",
    {
      title: "Apply several edits to a deck in one call",
      description:
        "Apply an ordered list of edits — add / remove / set / swap / art, same semantics as the single-purpose " +
        "tools — against one deck and save once. If any op fails nothing is saved and the error names the op. " +
        "Prefer this over a run of single calls: fewer turns, one response, and no chance of edits racing each other.",
      inputSchema: {
        deckId: z.string(),
        ops: z
          .array(
            z.discriminatedUnion("op", [
              z.object({ op: z.literal("add"), cardId: cardRef, count: z.number().int().min(1).max(60).default(1) }),
              z.object({ op: z.literal("remove"), cardId: cardRef, count: z.number().int().min(1).optional().describe("Omit to remove every copy.") }),
              z.object({ op: z.literal("set"), cardId: cardRef, count: z.number().int().min(0).max(60) }),
              z.object({
                op: z.literal("swap"),
                fromCardId: cardRef,
                toCardId: cardRef,
                count: z.number().int().min(1).optional().describe("Omit to move every copy."),
                allowDifferentCard: z.boolean().default(false),
              }),
              z.object({ op: z.literal("art"), cardId: cardRef, artCardId: cardRef.nullable() }),
            ]),
          )
          .min(1)
          .max(100),
        verbose: verboseArg,
        actAsUserId: actAs,
      },
    },
    async ({ deckId, ops, verbose, actAsUserId }) =>
      mutate(ctx, deckId, actAsUserId, ops as DeckOp[], verbose, "deck.update", { ops: ops.length }),
  );

  server.registerTool(
    "replace_deck_cards",
    {
      title: "Replace a deck's whole card list",
      description: "Overwrite the deck's contents with the given entries. Use for bulk rewrites; prefer edit_deck for incremental edits.",
      inputSchema: { deckId: z.string(), cards: z.array(cardEntry), verbose: verboseArg, actAsUserId: actAs },
    },
    async ({ deckId, cards, verbose, actAsUserId }) =>
      withDeckLock(deckId, async () => {
        const r = await loadOwnDeck(ctx, deckId, actAsUserId);
        if (!r.ok) return r.result;
        const e = await resolveEntries(cards);
        if (!e.ok) return e.result;
        return saveCards(deckId, r.value.userId, r.value.deck.cards, e.value, verbose, "deck.update", { replace: cards.length });
      }),
  );

  server.registerTool(
    "beautify_deck",
    {
      title: "Beautify a deck's printings",
      description:
        "Re-point every card at nicer printings. mode='best' puts all copies on the highest-rarity art; " +
        "mode='diverse' spreads copies across distinct arts. Same-name cards with different text are kept apart. " +
        "dryRun=true reports the planned changes without saving.",
      inputSchema: {
        deckId: z.string(),
        mode: z.enum(["best", "diverse"]).default("diverse"),
        excludeRarities: z.array(z.string()).default([]),
        excludePrintUnfriendly: z.boolean().default(true),
        seed: z.number().int().optional().describe("Seed for the 'diverse' shuffle, for reproducible results."),
        dryRun: z.boolean().default(false),
        verbose: verboseArg,
        actAsUserId: actAs,
      },
    },
    async ({ deckId, mode, excludeRarities, excludePrintUnfriendly, seed, dryRun, verbose, actAsUserId }) =>
      withDeckLock(deckId, async () => {
        const r = await loadOwnDeck(ctx, deckId, actAsUserId);
        if (!r.ok) return r.result;
        const outcome = beautifyDeckCards(
          r.value.deck.cards,
          (id) => getVariants(id),
          { mode, excludeRarities, excludePrintUnfriendly },
          seed !== undefined ? makeRng(seed) : Math.random,
        );
        if (dryRun) return asJson({ dryRun: true, changes: outcome.changes, cards: outcome.cards.map(compactEntry) });
        return saveCards(deckId, r.value.userId, r.value.deck.cards, outcome.cards, verbose, "deck.beautify", { mode, groups: outcome.changes.length });
      }),
  );

  server.registerTool(
    "check_deck_legality",
    {
      title: "Check deck legality",
      description:
        "Run the construction-rule checks (60 cards, 4-per-name, 1 Radiant, 1 ACE SPEC) on a deck. " +
        "Regulation-mark rotation is NOT checked (the app has no regulation-mark data).",
      inputSchema: { deckId: z.string(), actAsUserId: actAs },
    },
    async ({ deckId, actAsUserId }) => {
      const r = await loadOwnDeck(ctx, deckId, actAsUserId);
      if (!r.ok) return r.result;
      const issues = checkDeckLegality(r.value.deck.cards);
      return asJson({ deckId, legal: issues.every((i) => i.severity !== "error"), complete: issues.length === 0, issues, summary: summarize(r.value.deck.cards) });
    },
  );

  server.registerTool(
    "export_deck_text",
    {
      title: "Export a deck as text",
      description: "Render a deck as 'SETCODE LOCALID xCOUNT  # Name' lines (DecklistGen's import/export text format).",
      inputSchema: { deckId: z.string(), actAsUserId: actAs },
    },
    async ({ deckId, actAsUserId }) => {
      const r = await loadOwnDeck(ctx, deckId, actAsUserId);
      if (!r.ok) return r.result;
      const text = r.value.deck.cards.map((e) => `${e.card.setCode} ${e.card.localId} x${e.count}  # ${e.card.name}`).join("\n");
      return asJson({ deckId, name: r.value.deck.name, text });
    },
  );
}

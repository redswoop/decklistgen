import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../server.js";
import type { McpContext } from "../context.js";
import { loadSet } from "../../services/card-store.js";
import { createUser, deleteUser } from "../../services/user-store.js";
import { _setAutoProcess, _resetForTests } from "../../services/gen-queue.js";
import type { User } from "../../../shared/types/user.js";

/**
 * End-to-end over the in-memory MCP transport: a real McpServer with a given
 * identity, real SQLite deck store, real cached cards (SVI / SVE / PAF).
 */

const PREFIX = `mcp-decks-${Date.now()}`;
let admin: User, player: User, free: User;

async function client(ctx: McpContext): Promise<Client> {
  const server = createMcpServer(ctx);
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st);
  const c = new Client({ name: "t", version: "0" }, { capabilities: {} });
  await c.connect(ct);
  return c;
}

async function call(c: Client, name: string, args: Record<string, unknown> = {}): Promise<{ isError: boolean; data: any }> {
  const res = (await c.callTool({ name, arguments: args })) as { isError?: boolean; content: Array<{ type: string; text?: string }> };
  const text = res.content.find((b) => b.type === "text")?.text ?? "null";
  return { isError: !!res.isError, data: JSON.parse(text) };
}

beforeAll(async () => {
  await Promise.all([loadSet("SVI"), loadSet("SVE"), loadSet("PAF")]);
  admin = await createUser({ email: `${PREFIX}-admin@test.local`, password: "testpassword1", displayName: "Admin", isAdmin: true, isAuthorized: true });
  player = await createUser({ email: `${PREFIX}-player@test.local`, password: "testpassword1", displayName: "Magnus", isAuthorized: true });
  free = await createUser({ email: `${PREFIX}-free@test.local`, password: "testpassword1", displayName: "Free" });
  _setAutoProcess(false);
  _resetForTests();
});

afterAll(() => {
  for (const u of [admin, player, free]) if (u) deleteUser(u.id);
  _setAutoProcess(true);
});

describe("auth gating", () => {
  test("anonymous callers can browse but not touch decks", async () => {
    const c = await client({ user: null });
    const sets = await call(c, "list_sets");
    expect(sets.isError).toBe(false);
    const decks = await call(c, "list_decks");
    expect(decks.isError).toBe(true);
    expect(decks.data.error).toContain("Authentication required");
    const who = await call(c, "whoami");
    expect(who.isError).toBe(true);
  });

  test("whoami reports the token's user", async () => {
    const c = await client({ user: player });
    const who = await call(c, "whoami");
    expect(who.data).toMatchObject({ id: player.id, displayName: "Magnus", isAdmin: false, isAuthorized: true });
  });

  test("list_users is admin-only and filters", async () => {
    const p = await client({ user: player });
    expect((await call(p, "list_users")).isError).toBe(true);
    const a = await client({ user: admin });
    const r = await call(a, "list_users", { query: `${PREFIX}-player` });
    expect(r.data.users.map((u: User) => u.id)).toEqual([player.id]);
  });

  test("non-admins cannot act as someone else", async () => {
    const c = await client({ user: player });
    const r = await call(c, "list_decks", { actAsUserId: admin.id });
    expect(r.isError).toBe(true);
    expect(r.data.error).toContain("Admin");
  });

  test("admin acting as an unknown user gets a clear error", async () => {
    const c = await client({ user: admin });
    const r = await call(c, "list_decks", { actAsUserId: "nope" });
    expect(r.isError).toBe(true);
    expect(r.data.error).toContain("not found");
  });
});

describe("deck lifecycle", () => {
  let c: Client;
  let deckId: string;

  beforeAll(async () => {
    c = await client({ user: player });
  });

  test("create_deck seeds from ids and 'SET NUM' refs, consolidating duplicates", async () => {
    const r = await call(c, "create_deck", {
      name: "Cactus",
      cards: [
        { cardId: "sv01-005", count: 2 },
        { cardId: "SVI 005", count: 2 },
        { cardId: "sv01-006", count: 3 },
        { cardId: "PAF 54", count: 1 },
      ],
    });
    expect(r.isError).toBe(false);
    deckId = r.data.id;
    expect(r.data.name).toBe("Cactus");
    expect(r.data.summary).toMatchObject({ total: 8, pokemon: 8, unique: 3 });
    const cacnea = r.data.cards.find((x: any) => x.cardId === "sv01-005");
    expect(cacnea.count).toBe(4);
    expect(r.data.cards.find((x: any) => x.cardId === "sv04.5-054").name).toBe("Charizard ex");
  });

  test("create_deck rejects unknown cards", async () => {
    const r = await call(c, "create_deck", { name: "Bad", cards: [{ cardId: "zz99-999", count: 1 }] });
    expect(r.isError).toBe(true);
    expect(r.data.error).toContain("Unknown card");
  });

  test("create_deck from PTCGO text", async () => {
    const r = await call(c, "create_deck", { name: "Text", decklistText: "Pokémon: 1\n4 Cacnea SVI 5\nTrainer: 1\n2 Nest Ball SVI 181\n1 Bogus Card XYZ 1" });
    expect(r.isError).toBe(false);
    expect(r.data.summary.total).toBe(6);
    expect(r.data.unresolved).toHaveLength(1);
    expect(r.data.importSource).toBe("mcp:text");
    await call(c, "delete_deck", { deckId: r.data.id });
  });

  test("list_decks / find_decks / get_deck see it", async () => {
    const list = await call(c, "list_decks");
    expect(list.data.decks.some((d: any) => d.id === deckId)).toBe(true);
    const found = await call(c, "find_decks", { query: "cact" });
    expect(found.data.decks.map((d: any) => d.id)).toContain(deckId);
    const got = await call(c, "get_deck", { deckId });
    expect(got.data.cards).toHaveLength(3);
    expect(got.data.legality.some((i: any) => i.rule === "deck-size")).toBe(true);
    const full = await call(c, "get_deck", { deckId, full: true });
    expect(full.data.cards[0].card.name).toBeDefined();
  });

  const row = (r: { data: any }, id: string) => r.data.changed.find((x: any) => x.cardId === id);

  test("add_cards increments existing stacks and adds new ones; default response is the diff", async () => {
    const r = await call(c, "add_cards", { deckId, cards: [{ cardId: "sv01-006", count: 1 }, { cardId: "sv01-181", count: 4 }] });
    expect(r.isError).toBe(false);
    expect(r.data.cards).toBeUndefined();
    expect(r.data.summary.total).toBe(13);
    expect(Array.isArray(r.data.legality)).toBe(true);
    expect(r.data.changed).toHaveLength(2);
    expect(row(r, "sv01-006")).toMatchObject({ count: 4, previousCount: 3 });
    expect(row(r, "sv01-181")).toMatchObject({ count: 4, previousCount: 0 });
  });

  test("verbose=true returns the whole deck", async () => {
    const r = await call(c, "set_card_count", { deckId, cardId: "sve-001", count: 10, verbose: true });
    expect(r.data.changed).toBeUndefined();
    expect(r.data.cards.find((x: any) => x.cardId === "sve-001").count).toBe(10);
    expect(r.data.summary.energy).toBe(10);
  });

  test("remove_cards: partial, full, and not-in-deck", async () => {
    let r = await call(c, "remove_cards", { deckId, cards: [{ cardId: "sve-001", count: 3 }, { cardId: "sv04.5-054" }] });
    expect(r.data.summary.energy).toBe(7);
    expect(row(r, "sve-001")).toMatchObject({ count: 7, previousCount: 10 });
    expect(row(r, "sv04.5-054")).toMatchObject({ count: 0, previousCount: 1 });
    r = await call(c, "remove_cards", { deckId, cards: [{ cardId: "sv04.5-054" }] });
    expect(r.isError).toBe(true);
    expect(r.data.error).toContain("Not in deck");
    r = await call(c, "set_card_count", { deckId, cardId: "sve-001", count: 0 });
    expect(r.data.summary.energy).toBe(0);
    expect(row(r, "sve-001").count).toBe(0);
  });

  test("swap_card_printing moves some or all copies between printings of the same card", async () => {
    let r = await call(c, "swap_card_printing", { deckId, fromCardId: "sv01-181", toCardId: "sv01-255", count: 1 });
    expect(r.isError).toBe(false);
    expect(row(r, "sv01-181")).toMatchObject({ count: 3, previousCount: 4 });
    expect(row(r, "sv01-255")).toMatchObject({ count: 1, previousCount: 0 });
    r = await call(c, "swap_card_printing", { deckId, fromCardId: "sv01-181", toCardId: "sv01-255" });
    expect(row(r, "sv01-181").count).toBe(0);
    expect(row(r, "sv01-255").count).toBe(4);
  });

  test("swap_card_printing refuses a different card unless told otherwise", async () => {
    let r = await call(c, "swap_card_printing", { deckId, fromCardId: "sv01-255", toCardId: "sv01-196" });
    expect(r.isError).toBe(true);
    expect(r.data.error).toContain("not a printing of");
    r = await call(c, "swap_card_printing", { deckId, fromCardId: "sv01-255", toCardId: "sv01-196", allowDifferentCard: true, count: 2 });
    expect(r.isError).toBe(false);
    expect(row(r, "sv01-196").count).toBe(2);
    expect(row(r, "sv01-255").count).toBe(2);
  });

  test("set_card_art sets and clears the art override (reported as a change)", async () => {
    let r = await call(c, "set_card_art", { deckId, cardId: "sv01-255", artCardId: "sv01-181" });
    expect(row(r, "sv01-255")).toMatchObject({ count: 2, previousCount: 2, artCardId: "sv01-181" });
    r = await call(c, "set_card_art", { deckId, cardId: "sv01-255", artCardId: null });
    expect(row(r, "sv01-255").artCardId).toBeUndefined();
    const got = await call(c, "get_deck", { deckId });
    expect(got.data.cards.find((x: any) => x.cardId === "sv01-255").artCardId).toBeUndefined();
  });

  test("edit_deck applies ops in order with a single save", async () => {
    const before = await call(c, "get_deck", { deckId });
    const r = await call(c, "edit_deck", {
      deckId,
      ops: [
        { op: "add", cardId: "sve-001", count: 4 },
        { op: "set", cardId: "sve-001", count: 6 },
        { op: "swap", fromCardId: "sv01-196", toCardId: "sv01-181", allowDifferentCard: true },
        { op: "remove", cardId: "sv01-255", count: 1 },
        { op: "art", cardId: "sv01-255", artCardId: "sv01-181" },
      ],
    });
    expect(r.isError).toBe(false);
    expect(row(r, "sve-001")).toMatchObject({ count: 6, previousCount: 0 });
    expect(row(r, "sv01-196")).toMatchObject({ count: 0, previousCount: 2 });
    expect(row(r, "sv01-181")).toMatchObject({ count: 2, previousCount: 0 });
    expect(row(r, "sv01-255")).toMatchObject({ count: 1, previousCount: 2, artCardId: "sv01-181" });
    expect(r.data.summary.total).toBe(before.data.summary.total + 5); // +6 energy, -1 Nest Ball
  });

  test("edit_deck: a failing op aborts the batch and nothing is saved", async () => {
    const before = await call(c, "get_deck", { deckId });
    const r = await call(c, "edit_deck", {
      deckId,
      ops: [
        { op: "add", cardId: "sve-002", count: 1 },
        { op: "remove", cardId: "sv04.5-054" },
      ],
    });
    expect(r.isError).toBe(true);
    expect(r.data.error).toContain("Op 2 of 2 (remove) failed, nothing saved");
    const after = await call(c, "get_deck", { deckId });
    expect(after.data.updatedAt).toBe(before.data.updatedAt);
    expect(after.data.summary.total).toBe(before.data.summary.total);
  });

  test("parallel mutations on one deck are serialized, none lost", async () => {
    const before = await call(c, "get_deck", { deckId });
    const results = await Promise.all([
      call(c, "add_cards", { deckId, cards: [{ cardId: "sve-002", count: 1 }] }),
      call(c, "add_cards", { deckId, cards: [{ cardId: "sve-003", count: 1 }] }),
      call(c, "add_cards", { deckId, cards: [{ cardId: "sve-004", count: 1 }] }),
    ]);
    expect(results.every((r) => !r.isError)).toBe(true);
    const after = await call(c, "get_deck", { deckId });
    expect(after.data.summary.total).toBe(before.data.summary.total + 3);
    await call(c, "edit_deck", { deckId, ops: [{ op: "remove", cardId: "sve-002" }, { op: "remove", cardId: "sve-003" }, { op: "remove", cardId: "sve-004" }] });
  });

  test("beautify_deck dryRun plans without saving; real run saves", async () => {
    const before = await call(c, "get_deck", { deckId });
    const dry = await call(c, "beautify_deck", { deckId, mode: "best", dryRun: true, seed: 1 });
    expect(dry.data.dryRun).toBe(true);
    expect(Array.isArray(dry.data.changes)).toBe(true);
    const after = await call(c, "get_deck", { deckId });
    expect(after.data.updatedAt).toBe(before.data.updatedAt);
    const real = await call(c, "beautify_deck", { deckId, mode: "best", seed: 1 });
    expect(real.isError).toBe(false);
    expect(real.data.summary.total).toBe(before.data.summary.total);
    // Nest Ball: best art is the hyper rare 255 — the 181 stack folds into it
    expect(real.data.changed.find((x: any) => x.cardId === "sv01-181").count).toBe(0);
    const got = await call(c, "get_deck", { deckId });
    expect(got.data.cards.find((x: any) => x.name === "Nest Ball").cardId).toBe("sv01-255");
  });

  test("check_deck_legality and export_deck_text", async () => {
    const leg = await call(c, "check_deck_legality", { deckId });
    expect(leg.data.legal).toBe(true);
    expect(leg.data.complete).toBe(false);
    const txt = await call(c, "export_deck_text", { deckId });
    expect(txt.data.text).toContain("SVI 005 x4  # Cacnea");
  });

  test("replace_deck_cards overwrites wholesale", async () => {
    const r = await call(c, "replace_deck_cards", { deckId, cards: [{ cardId: "sve-002", count: 60 }] });
    expect(r.data.summary).toMatchObject({ total: 60, energy: 60, unique: 1 });
  });

  test("rename / visibility / copy / delete", async () => {
    let r = await call(c, "rename_deck", { deckId, name: "Cactus v2" });
    expect(r.data.name).toBe("Cactus v2");
    r = await call(c, "set_deck_visibility", { deckId, isListed: true });
    expect(r.data).toMatchObject({ isPublic: true, isListed: true });
    const copy = await call(c, "copy_deck", { deckId });
    expect(copy.data.name).toBe("Cactus v2 (Copy)");
    expect(copy.data.isPublic).toBe(false);
    r = await call(c, "delete_deck", { deckId: copy.data.id });
    expect(r.data.ok).toBe(true);
    r = await call(c, "delete_deck", { deckId: copy.data.id });
    expect(r.isError).toBe(true);
  });

  test("another user can read the public deck but not edit it; admin can act-as", async () => {
    const other = await client({ user: free });
    const read = await call(other, "get_deck", { deckId });
    expect(read.isError).toBe(false);
    const edit = await call(other, "add_cards", { deckId, cards: [{ cardId: "sve-001", count: 1 }] });
    expect(edit.isError).toBe(true);
    const a = await client({ user: admin });
    const viaAdmin = await call(a, "find_decks", { query: "cactus v2", allUsers: true });
    expect(viaAdmin.data.decks[0]).toMatchObject({ id: deckId, ownerId: player.id });
    const edited = await call(a, "set_card_count", { deckId, cardId: "sve-001", count: 1, actAsUserId: player.id });
    expect(edited.isError).toBe(false);
    expect(edited.data.summary.total).toBe(61);
  });

  test("simulators run against the saved deck", async () => {
    await call(c, "replace_deck_cards", {
      deckId,
      cards: [{ cardId: "sv01-005", count: 4 }, { cardId: "sv01-006", count: 4 }, { cardId: "sv01-181", count: 4 }, { cardId: "sve-001", count: 48 }],
    });
    const hands = await call(c, "simulate_opening_hands", { deckId, iterations: 500, seed: 3 });
    expect(hands.isError).toBe(false);
    expect(hands.data.stats.deckSize).toBe(60);
    expect(hands.data.interpretation.length).toBeGreaterThan(0);
    const setup = await call(c, "simulate_setup", { deckId, iterations: 300, seed: 3, turns: 3 });
    expect(setup.isError).toBe(false);
    const line = setup.data.lines.find((l: any) => l.line.finalName === "Cacturne");
    expect(line.result.cumulativeSetup).toHaveLength(3);
    expect(typeof line.interpretation).toBe("string");
  });

  test("art status + generate gating", async () => {
    const status = await call(c, "deck_art_status", { deckId });
    expect(status.data.printings).toBe(4);
    expect(status.data.cards[0]).toHaveProperty("hasComposite");
    const f = await client({ user: free });
    const denied = await call(f, "generate_deck_art", { deckId });
    expect(denied.isError).toBe(true);
    expect(denied.data.error).toContain("Authorized");
    const q = await call(c, "get_generation_queue");
    expect(q.isError).toBe(false);
    expect(Array.isArray(q.data.jobs)).toBe(true);
  });

  test("cleanup", async () => {
    const r = await call(c, "delete_deck", { deckId });
    expect(r.data.ok).toBe(true);
  });
});

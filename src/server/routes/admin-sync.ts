import { Hono } from "hono";
import type { AppEnv } from "../types.js";
import type { SavedDeck } from "../../shared/types/deck.js";
import { requireAuthorized } from "../middleware/auth.js";
import { getDb } from "../services/db/database.js";
import { createDeck, getDeck, updateDeck } from "../services/deck-store.js";
import { logAction, getClientIp } from "../services/logger.js";
import {
  RemoteSyncError,
  fetchRemoteDeck,
  fetchRemoteDeckSummaries,
  loginRemote,
  normalizeServerUrl,
} from "../services/deck-sync.js";

const app = new Hono<AppEnv>();

app.use("*", requireAuthorized);

type Strategy = "skip" | "overwrite" | "duplicate";

interface ListBody {
  url: string;
  email: string;
  password: string;
}

interface ImportBody extends ListBody {
  deckIds: string[];
  strategy: Strategy;
}

function asSyncError(e: unknown): { message: string; status: number } {
  if (e instanceof RemoteSyncError) return { message: e.message, status: e.status };
  return { message: e instanceof Error ? e.message : String(e), status: 500 };
}

function validateListBody(body: Partial<ListBody>): string | null {
  if (!body.url?.trim()) return "Server URL is required";
  if (!body.email?.trim()) return "Email is required";
  if (!body.password) return "Password is required";
  return null;
}

/** Log into the remote and return its deck list. */
app.post("/list", async (c) => {
  const body = await c.req.json<ListBody>();
  const err = validateListBody(body);
  if (err) return c.json({ error: err }, 400);

  let url: string;
  try {
    url = normalizeServerUrl(body.url);
  } catch (e) {
    const { message, status } = asSyncError(e);
    return c.json({ error: message }, status as 400);
  }

  try {
    const { summaries } = await fetchRemoteDeckSummaries(url, body.email, body.password);
    return c.json({ decks: summaries, url });
  } catch (e) {
    const { message, status } = asSyncError(e);
    return c.json({ error: message }, status as 401);
  }
});

/** Fetch selected remote decks and insert/update them locally per strategy. */
app.post("/import", async (c) => {
  const user = c.get("user")!;
  const body = await c.req.json<ImportBody>();

  const err = validateListBody(body);
  if (err) return c.json({ error: err }, 400);
  if (!Array.isArray(body.deckIds) || body.deckIds.length === 0) {
    return c.json({ error: "deckIds must be a non-empty array" }, 400);
  }
  if (!["skip", "overwrite", "duplicate"].includes(body.strategy)) {
    return c.json({ error: "strategy must be one of: skip, overwrite, duplicate" }, 400);
  }

  let url: string;
  try {
    url = normalizeServerUrl(body.url);
  } catch (e) {
    const { message, status } = asSyncError(e);
    return c.json({ error: message }, status as 400);
  }

  let sessionCookie: string;
  try {
    sessionCookie = await loginRemote(url, body.email, body.password);
  } catch (e) {
    const { message, status } = asSyncError(e);
    return c.json({ error: message }, status as 401);
  }

  const imported: string[] = [];
  const skipped: string[] = [];
  const overwritten: string[] = [];
  const errors: { deckId: string; message: string }[] = [];
  const now = new Date().toISOString();

  for (const deckId of body.deckIds) {
    try {
      const remote = await fetchRemoteDeck(url, sessionCookie, deckId);
      // Visibility is per-server — never carry over isPublic/isListed on import.
      const sanitized: SavedDeck = {
        ...remote,
        isPublic: false,
        isListed: false,
        importSource: url,
        importedAt: now,
      };

      if (body.strategy === "duplicate") {
        const copy: SavedDeck = { ...sanitized, id: crypto.randomUUID() };
        await createDeck(user.id, copy);
        imported.push(copy.id);
        continue;
      }

      const existing = await getDeck(remote.id);
      if (!existing) {
        await createDeck(user.id, sanitized);
        imported.push(sanitized.id);
        continue;
      }

      if (body.strategy === "skip") {
        skipped.push(remote.id);
        continue;
      }

      // overwrite — only allowed if the local row belongs to the current user.
      const ownerRow = getDb()
        .query("SELECT user_id FROM decks WHERE id = ?")
        .get(remote.id) as { user_id: string } | null;
      if (!ownerRow || ownerRow.user_id !== user.id) {
        errors.push({ deckId: remote.id, message: "Local deck is owned by another user" });
        continue;
      }
      await updateDeck(remote.id, user.id, {
        name: sanitized.name,
        cards: sanitized.cards,
      });
      overwritten.push(remote.id);
    } catch (e) {
      const { message } = asSyncError(e);
      errors.push({ deckId, message });
    }
  }

  logAction("deck.sync", getClientIp(c), {
    source: url,
    strategy: body.strategy,
    requested: body.deckIds.length,
    imported: imported.length,
    skipped: skipped.length,
    overwritten: overwritten.length,
    errors: errors.length,
  });

  return c.json({ imported, skipped, overwritten, errors });
});

export default app;

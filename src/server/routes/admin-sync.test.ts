import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from "bun:test";
import { Hono } from "hono";
import adminSyncRouter from "./admin-sync.js";
import { sessionMiddleware } from "../middleware/auth.js";
import { createUser, deleteUser, findUserByEmail } from "../services/user-store.js";
import { createSession } from "../services/session-store.js";
import { createDeck, deleteDeck, listDecks } from "../services/deck-store.js";
import type { AppEnv } from "../types.js";
import type { SavedDeck, DeckSummary } from "../../shared/types/deck.js";

const app = new Hono<AppEnv>();
app.use("*", sessionMiddleware);
app.route("/sync", adminSyncRouter);

const TEST_PREFIX = `sync-test-${Date.now()}`;
const REMOTE_URL = "https://remote.invalid";

let adminUserId: string;
let adminSessionCookie: string;
let secondUserId: string;
const createdDeckIds: string[] = [];
const createdEmails: string[] = [];

const origFetch = globalThis.fetch;

beforeAll(async () => {
  const adminEmail = `${TEST_PREFIX}-admin@test.local`;
  const admin = await createUser({
    email: adminEmail,
    password: "testpass123",
    displayName: "Sync Admin",
    isAdmin: true,
    isAuthorized: true,
  });
  adminUserId = admin.id;
  createdEmails.push(adminEmail);
  const session = createSession(admin.id);
  adminSessionCookie = `session=${session.id}`;

  const secondEmail = `${TEST_PREFIX}-other@test.local`;
  const other = await createUser({
    email: secondEmail,
    password: "testpass123",
    displayName: "Other User",
    isAuthorized: true,
  });
  secondUserId = other.id;
  createdEmails.push(secondEmail);
});

afterAll(() => {
  for (const id of createdDeckIds) {
    try { deleteDeck(id, adminUserId); } catch {}
    try { deleteDeck(id, secondUserId); } catch {}
  }
  for (const email of createdEmails) {
    const u = findUserByEmail(email);
    if (u) deleteUser(u.id);
  }
});

afterEach(() => {
  globalThis.fetch = origFetch;
});

function jsonPost(path: string, body: unknown, cookie?: string) {
  return app.request(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

interface RemoteState {
  loginStatus?: number;
  loginError?: string;
  summaries?: DeckSummary[];
  decks?: Record<string, SavedDeck>;
  deckFetchError?: { id: string; status: number; message: string };
}

function stubRemote(state: RemoteState) {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.endsWith("/api/auth/login")) {
      if (state.loginStatus && state.loginStatus >= 400) {
        return new Response(JSON.stringify({ error: state.loginError ?? "Login failed" }), {
          status: state.loginStatus,
        });
      }
      return new Response(JSON.stringify({ id: "remote-user" }), {
        status: 200,
        headers: { "Set-Cookie": "session=remote-session-abc; Path=/; HttpOnly" },
      });
    }
    if (url.endsWith("/api/decks")) {
      return new Response(JSON.stringify(state.summaries ?? []), { status: 200 });
    }
    const match = url.match(/\/api\/decks\/([^/?]+)$/);
    if (match) {
      const id = decodeURIComponent(match[1]);
      if (state.deckFetchError?.id === id) {
        return new Response(JSON.stringify({ error: state.deckFetchError.message }), {
          status: state.deckFetchError.status,
        });
      }
      const deck = state.decks?.[id];
      if (!deck) return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
      return new Response(JSON.stringify(deck), { status: 200 });
    }
    return new Response(JSON.stringify({ error: "Unexpected URL" }), { status: 500 });
  }) as typeof fetch;
}

function makeRemoteDeck(id: string, name: string): SavedDeck {
  return {
    id,
    name,
    cards: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    isPublic: true,
    isListed: true,
  };
}

describe("POST /sync/list", () => {
  test("returns 401 when remote login fails", async () => {
    stubRemote({ loginStatus: 401, loginError: "Invalid email or password" });
    const res = await jsonPost("/sync/list", {
      url: REMOTE_URL,
      email: "x@x.com",
      password: "wrong",
    }, adminSessionCookie);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Invalid email or password");
  });

  test("returns deck summaries on success", async () => {
    const summaries: DeckSummary[] = [
      { id: "deck-1", name: "Charizard ex", cardCount: 60, uniqueCards: 20, createdAt: "x", updatedAt: "x" },
      { id: "deck-2", name: "Miraidon ex", cardCount: 60, uniqueCards: 18, createdAt: "x", updatedAt: "x" },
    ];
    stubRemote({ summaries });
    const res = await jsonPost("/sync/list", {
      url: REMOTE_URL,
      email: "a@b.com",
      password: "pw",
    }, adminSessionCookie);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.decks).toHaveLength(2);
    expect(body.decks[0].name).toBe("Charizard ex");
    expect(body.url).toBe(REMOTE_URL);
  });

  test("requires authentication", async () => {
    const res = await jsonPost("/sync/list", {
      url: REMOTE_URL,
      email: "a@b.com",
      password: "pw",
    });
    expect(res.status).toBe(401);
  });

  test("rejects missing fields", async () => {
    const res = await jsonPost("/sync/list", { url: "", email: "", password: "" }, adminSessionCookie);
    expect(res.status).toBe(400);
  });
});

describe("POST /sync/import", () => {
  test("strategy=skip leaves existing local deck untouched and reports it as skipped", async () => {
    const dupId = `${TEST_PREFIX}-dup-${crypto.randomUUID()}`;
    const localOriginal: SavedDeck = {
      id: dupId,
      name: "Local original",
      cards: [],
      createdAt: "2025-12-31T00:00:00.000Z",
      updatedAt: "2025-12-31T00:00:00.000Z",
    };
    await createDeck(adminUserId, localOriginal);
    createdDeckIds.push(dupId);

    stubRemote({
      decks: { [dupId]: makeRemoteDeck(dupId, "Remote version") },
    });
    const res = await jsonPost("/sync/import", {
      url: REMOTE_URL,
      email: "a@b.com",
      password: "pw",
      deckIds: [dupId],
      strategy: "skip",
    }, adminSessionCookie);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skipped).toEqual([dupId]);
    expect(body.imported).toEqual([]);

    const localDecks = await listDecks(adminUserId);
    const after = localDecks.find((d) => d.id === dupId);
    expect(after?.name).toBe("Local original");
  });

  test("strategy=overwrite refuses to mutate a deck owned by another user", async () => {
    const dupId = `${TEST_PREFIX}-foreign-${crypto.randomUUID()}`;
    await createDeck(secondUserId, {
      id: dupId,
      name: "Other user's deck",
      cards: [],
      createdAt: "2025-12-31T00:00:00.000Z",
      updatedAt: "2025-12-31T00:00:00.000Z",
    });
    createdDeckIds.push(dupId);

    stubRemote({
      decks: { [dupId]: makeRemoteDeck(dupId, "Hostile rename") },
    });
    const res = await jsonPost("/sync/import", {
      url: REMOTE_URL,
      email: "a@b.com",
      password: "pw",
      deckIds: [dupId],
      strategy: "overwrite",
    }, adminSessionCookie);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].deckId).toBe(dupId);
    expect(body.errors[0].message).toContain("another user");
    expect(body.overwritten).toEqual([]);

    const otherDecks = await listDecks(secondUserId);
    const after = otherDecks.find((d) => d.id === dupId);
    expect(after?.name).toBe("Other user's deck");
  });

  test("strategy=overwrite updates an existing deck owned by current user", async () => {
    const dupId = `${TEST_PREFIX}-own-overwrite-${crypto.randomUUID()}`;
    await createDeck(adminUserId, {
      id: dupId,
      name: "Stale local copy",
      cards: [],
      createdAt: "2025-12-31T00:00:00.000Z",
      updatedAt: "2025-12-31T00:00:00.000Z",
    });
    createdDeckIds.push(dupId);

    stubRemote({
      decks: { [dupId]: makeRemoteDeck(dupId, "Fresh remote name") },
    });
    const res = await jsonPost("/sync/import", {
      url: REMOTE_URL,
      email: "a@b.com",
      password: "pw",
      deckIds: [dupId],
      strategy: "overwrite",
    }, adminSessionCookie);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.overwritten).toEqual([dupId]);

    const decks = await listDecks(adminUserId);
    expect(decks.find((d) => d.id === dupId)?.name).toBe("Fresh remote name");
  });

  test("strategy=duplicate inserts a new row with a different UUID", async () => {
    const remoteId = `${TEST_PREFIX}-dup-uuid-${crypto.randomUUID()}`;
    stubRemote({
      decks: { [remoteId]: makeRemoteDeck(remoteId, "Duplicated deck") },
    });
    const before = await listDecks(adminUserId);
    const res = await jsonPost("/sync/import", {
      url: REMOTE_URL,
      email: "a@b.com",
      password: "pw",
      deckIds: [remoteId],
      strategy: "duplicate",
    }, adminSessionCookie);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.imported).toHaveLength(1);
    expect(body.imported[0]).not.toBe(remoteId);

    const after = await listDecks(adminUserId);
    expect(after.length).toBe(before.length + 1);
    const newDeck = after.find((d) => d.id === body.imported[0]);
    expect(newDeck?.name).toBe("Duplicated deck");
    createdDeckIds.push(body.imported[0]);
  });

  test("inserts a fresh deck (no collision) and strips isPublic/isListed", async () => {
    const remoteId = `${TEST_PREFIX}-fresh-${crypto.randomUUID()}`;
    stubRemote({
      decks: { [remoteId]: makeRemoteDeck(remoteId, "Fresh import") },
    });
    const res = await jsonPost("/sync/import", {
      url: REMOTE_URL,
      email: "a@b.com",
      password: "pw",
      deckIds: [remoteId],
      strategy: "skip",
    }, adminSessionCookie);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.imported).toEqual([remoteId]);
    createdDeckIds.push(remoteId);

    const decks = await listDecks(adminUserId);
    const inserted = decks.find((d) => d.id === remoteId);
    expect(inserted?.name).toBe("Fresh import");
    expect(inserted?.isPublic).toBe(false);
    expect(inserted?.isListed).toBe(false);
    expect(inserted?.importSource).toBe(REMOTE_URL);
  });

  test("rejects bad strategy", async () => {
    const res = await jsonPost("/sync/import", {
      url: REMOTE_URL,
      email: "a@b.com",
      password: "pw",
      deckIds: ["x"],
      strategy: "wat",
    }, adminSessionCookie);
    expect(res.status).toBe(400);
  });

  test("rejects empty deckIds", async () => {
    const res = await jsonPost("/sync/import", {
      url: REMOTE_URL,
      email: "a@b.com",
      password: "pw",
      deckIds: [],
      strategy: "skip",
    }, adminSessionCookie);
    expect(res.status).toBe(400);
  });
});

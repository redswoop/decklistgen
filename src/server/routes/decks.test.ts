import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { Hono } from "hono";
import decksRouter from "./decks.js";
import { sessionMiddleware } from "../middleware/auth.js";
import { createUser, deleteUser } from "../services/user-store.js";
import { createSession, deleteUserSessions } from "../services/session-store.js";
import type { AppEnv } from "../types.js";

// Build a test app: sessionMiddleware resolves the user, the deck router mounts
// requireAuth internally.
const app = new Hono<AppEnv>();
app.use("*", sessionMiddleware);
app.route("/decks", decksRouter);

const TEST_PREFIX = `decks-test-${Date.now()}`;
let adminId: string, otherId: string, freeId: string;
let adminSession: string, otherSession: string, freeSession: string;

/** Make a request, optionally with a session cookie and an X-Act-As-User header. */
function req(path: string, opts?: RequestInit & { session?: string; actAs?: string }) {
  const { session, actAs, ...init } = opts ?? {};
  const headers = new Headers(init.headers);
  if (session) headers.set("Cookie", `session=${session}`);
  if (actAs) headers.set("X-Act-As-User", actAs);
  return app.request(path, { ...init, headers });
}

function postJson(path: string, body: unknown, opts?: { session?: string; actAs?: string }) {
  return req(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    ...opts,
  });
}

function putJson(path: string, body: unknown, opts?: { session?: string; actAs?: string }) {
  return req(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    ...opts,
  });
}

function patchJson(path: string, body: unknown, opts?: { session?: string; actAs?: string }) {
  return req(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    ...opts,
  });
}

/** Create a deck for the given session and return its id. */
async function makeDeck(name: string, session: string): Promise<string> {
  const res = await postJson("/decks", { name, cards: [] }, { session });
  expect(res.status).toBe(201);
  const body = await res.json();
  return body.id as string;
}

beforeAll(async () => {
  const admin = await createUser({
    email: `${TEST_PREFIX}-admin@test.local`,
    password: "testpassword1",
    displayName: "Test Admin",
    isAdmin: true,
    isAuthorized: true,
  });
  adminId = admin.id;
  adminSession = createSession(admin.id).id;

  const other = await createUser({
    email: `${TEST_PREFIX}-other@test.local`,
    password: "testpassword2",
    displayName: "Other User",
    isAuthorized: true,
  });
  otherId = other.id;
  otherSession = createSession(other.id).id;

  const free = await createUser({
    email: `${TEST_PREFIX}-free@test.local`,
    password: "testpassword3",
    displayName: "Free User",
  });
  freeId = free.id;
  freeSession = createSession(free.id).id;
});

afterAll(() => {
  for (const id of [adminId, otherId, freeId]) {
    if (id) {
      deleteUserSessions(id);
      deleteUser(id); // cascades to that user's decks
    }
  }
});

describe("deck act-as: permission gate", () => {
  test("401 without a session", async () => {
    const res = await req("/decks");
    expect(res.status).toBe(401);
  });

  test("non-admin cannot impersonate (403)", async () => {
    const res = await req("/decks", { session: freeSession, actAs: adminId });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Admin");
  });

  test("non-admin other user cannot impersonate (403)", async () => {
    const res = await req("/decks", { session: otherSession, actAs: adminId });
    expect(res.status).toBe(403);
  });

  test("admin acting as a nonexistent user → 404", async () => {
    const res = await req("/decks", { session: adminSession, actAs: "does-not-exist" });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("not found");
  });
});

describe("deck act-as: scoping", () => {
  test("admin acting as another user lists exactly that user's decks", async () => {
    const otherDeck = await makeDeck("Other's Deck", otherSession);
    const adminDeck = await makeDeck("Admin's Deck", adminSession);

    // Admin without header → only own decks
    const own = await (await req("/decks", { session: adminSession })).json();
    const ownIds = own.map((d: { id: string }) => d.id);
    expect(ownIds).toContain(adminDeck);
    expect(ownIds).not.toContain(otherDeck);

    // Admin acting as other → only other's decks
    const asOther = await (await req("/decks", { session: adminSession, actAs: otherId })).json();
    const asOtherIds = asOther.map((d: { id: string }) => d.id);
    expect(asOtherIds).toContain(otherDeck);
    expect(asOtherIds).not.toContain(adminDeck);
  });

  test("admin acting as self (header == own id) behaves like no header", async () => {
    const res = await req("/decks", { session: adminSession, actAs: adminId });
    expect(res.status).toBe(200);
  });
});

describe("deck act-as: management", () => {
  test("admin can edit another user's deck; change persists to that user", async () => {
    const id = await makeDeck("Editable", otherSession);

    const res = await putJson(`/decks/${id}`, { name: "Renamed by Admin" }, { session: adminSession, actAs: otherId });
    expect(res.status).toBe(200);

    // Owner sees the change without any header
    const owner = await (await req(`/decks/${id}`, { session: otherSession })).json();
    expect(owner.name).toBe("Renamed by Admin");
  });

  test("admin cannot edit another user's deck WITHOUT the header (404 — scoped to own id)", async () => {
    const id = await makeDeck("Private", otherSession);
    const res = await putJson(`/decks/${id}`, { name: "Sneaky" }, { session: adminSession });
    expect(res.status).toBe(404);
  });

  test("admin can toggle another user's deck visibility", async () => {
    const id = await makeDeck("ToList", otherSession);
    const res = await patchJson(`/decks/${id}/visibility`, { isListed: true }, { session: adminSession, actAs: otherId });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isListed).toBe(true);
    expect(body.isPublic).toBe(true);
  });

  test("admin can copy another user's deck into that user's collection", async () => {
    const id = await makeDeck("Original", otherSession);
    const res = await postJson(`/decks/${id}/copy`, { name: "The Copy" }, { session: adminSession, actAs: otherId });
    expect(res.status).toBe(201);
    const copy = await res.json();
    expect(copy.name).toBe("The Copy");

    // The copy belongs to the other user
    const ownerList = await (await req("/decks", { session: otherSession })).json();
    expect(ownerList.map((d: { id: string }) => d.id)).toContain(copy.id);
  });

  test("admin can delete another user's deck", async () => {
    const id = await makeDeck("Doomed", otherSession);
    const res = await req(`/decks/${id}`, { method: "DELETE", session: adminSession, actAs: otherId });
    expect(res.status).toBe(200);

    const gone = await req(`/decks/${id}`, { session: otherSession });
    expect(gone.status).toBe(404);
  });

  test("admin can create a deck on behalf of another user", async () => {
    const res = await postJson("/decks", { name: "Made for Other", cards: [] }, { session: adminSession, actAs: otherId });
    expect(res.status).toBe(201);
    const deck = await res.json();

    const ownerList = await (await req("/decks", { session: otherSession })).json();
    expect(ownerList.map((d: { id: string }) => d.id)).toContain(deck.id);
  });

  test("non-admin cannot delete another user's deck via header (403)", async () => {
    const id = await makeDeck("Safe", otherSession);
    const res = await req(`/decks/${id}`, { method: "DELETE", session: freeSession, actAs: otherId });
    expect(res.status).toBe(403);
  });
});

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { Hono } from "hono";
import { writeFileSync, mkdirSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import proxyRouter from "./proxy.js";
import { sessionMiddleware } from "../middleware/auth.js";
import { loadSet } from "../services/card-store.js";
import { createUser, deleteUser } from "../services/user-store.js";
import { createSession, deleteUserSessions } from "../services/session-store.js";
import type { AppEnv } from "../types.js";

const CACHE_DIR = join(import.meta.dir, "../../../cache");

// Tiny 1x1 white PNG for mock card images
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
  "base64",
);

const MOCK_CARD_ID = "cel25-1";
const MOCK_CARD_JSON = {
  id: "cel25-1",
  localId: "1",
  name: "Ho-Oh",
  category: "Pokemon",
  hp: 130,
  types: ["Fire"],
  stage: "Basic",
  retreat: 2,
  rarity: "Rare",
  image: "https://assets.tcgdex.net/en/cel25/cel25/1",
  set: { id: "cel25", name: "Celebrations" },
  attacks: [
    { cost: ["Fire", "Colorless"], name: "Sacred Fire", effect: "This attack does 50 damage." },
    { cost: ["Fire", "Fire", "Colorless"], name: "Fire Blast", effect: "Discard an Energy.", damage: 120 },
  ],
  weaknesses: [{ type: "Lightning", value: "×2" }],
};

const NONEXISTENT_CARD = "zzz99-999";

// Build a test app with session middleware + proxy routes
const app = new Hono<AppEnv>();
app.use("*", sessionMiddleware);
app.route("/pokeproxy", proxyRouter);

// --- Test users ---
const TEST_PREFIX = `proxy-auth-test-${Date.now()}`;
let adminSession: string;
let authorizedSession: string;
let freeSession: string;
let adminId: string;
let authorizedId: string;
let freeId: string;

function req(path: string, opts?: RequestInit & { session?: string }) {
  const { session, ...init } = opts ?? {};
  const headers = new Headers(init.headers);
  if (session) headers.set("Cookie", `session=${session}`);
  return app.request(path, { ...init, headers });
}

function postJson(path: string, body: unknown, session?: string) {
  return req(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    session,
  });
}

function putJson(path: string, body: unknown, session?: string) {
  return req(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    session,
  });
}

function del(path: string, session?: string) {
  return req(path, { method: "DELETE", session });
}

beforeAll(async () => {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(join(CACHE_DIR, `${MOCK_CARD_ID}.json`), JSON.stringify(MOCK_CARD_JSON));
  writeFileSync(join(CACHE_DIR, `${MOCK_CARD_ID}.png`), TINY_PNG);
  await loadSet("CEL");

  // Create test users with different auth levels
  const admin = await createUser({
    email: `${TEST_PREFIX}-admin@test.local`,
    password: "testpassword1",
    displayName: "Test Admin",
    isAdmin: true,
    isAuthorized: true,
  });
  adminId = admin.id;
  adminSession = createSession(admin.id).id;

  const authorized = await createUser({
    email: `${TEST_PREFIX}-auth@test.local`,
    password: "testpassword2",
    displayName: "Test Authorized",
    isAuthorized: true,
  });
  authorizedId = authorized.id;
  authorizedSession = createSession(authorized.id).id;

  const free = await createUser({
    email: `${TEST_PREFIX}-free@test.local`,
    password: "testpassword3",
    displayName: "Test Free",
  });
  freeId = free.id;
  freeSession = createSession(free.id).id;
});

afterAll(() => {
  // Clean up sessions and users
  for (const id of [adminId, authorizedId, freeId]) {
    if (id) {
      deleteUserSessions(id);
      deleteUser(id);
    }
  }
  // Clean up any artifacts we created
  for (const suffix of ["_clean.png", "_composite.png", "_clean_meta.json"]) {
    const p = join(CACHE_DIR, `${MOCK_CARD_ID}${suffix}`);
    try { unlinkSync(p); } catch {}
  }
});

// =========================================================================
// Status endpoints (public — no auth required)
// =========================================================================

describe("GET /pokeproxy/status/:cardId", () => {
  test("returns status for existing card without auth", async () => {
    const res = await req(`/pokeproxy/status/${MOCK_CARD_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cardId).toBe(MOCK_CARD_ID);
    expect(typeof body.hasClean).toBe("boolean");
    expect(typeof body.hasComposite).toBe("boolean");
    expect(typeof body.hasSvg).toBe("boolean");
  });

  test("returns status for nonexistent card (all false)", async () => {
    const res = await req(`/pokeproxy/status/${NONEXISTENT_CARD}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hasClean).toBe(false);
    expect(body.hasComposite).toBe(false);
    expect(body.hasSvg).toBe(false);
  });
});

describe("POST /pokeproxy/status/batch", () => {
  test("returns batch status without auth", async () => {
    const res = await postJson("/pokeproxy/status/batch", {
      cardIds: [MOCK_CARD_ID, NONEXISTENT_CARD],
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body[MOCK_CARD_ID]).toBeDefined();
    expect(body[NONEXISTENT_CARD]).toBeDefined();
  });

  test("handles empty array", async () => {
    const res = await postJson("/pokeproxy/status/batch", { cardIds: [] });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body)).toHaveLength(0);
  });
});

// =========================================================================
// Image serving (public)
// =========================================================================

describe("GET /pokeproxy/image/:cardId/:type", () => {
  test("returns 404 for nonexistent card image", async () => {
    const res = await req(`/pokeproxy/image/${NONEXISTENT_CARD}/composite`);
    expect(res.status).toBe(404);
  });

  test("returns 400 for invalid image type", async () => {
    const res = await req(`/pokeproxy/image/${MOCK_CARD_ID}/garbage`);
    expect(res.status).toBe(400);
  });

  test("serves source image", async () => {
    const res = await req(`/pokeproxy/image/${MOCK_CARD_ID}/source`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
  });
});

// =========================================================================
// SVG endpoints (public)
// =========================================================================

describe("GET /pokeproxy/svg/:cardId", () => {
  test("renders SVG without auth", async () => {
    const res = await req(`/pokeproxy/svg/${MOCK_CARD_ID}`);
    expect(res.status).toBe(200);
    const svg = await res.text();
    expect(svg).toStartWith("<svg");
    expect(svg).toContain("Ho-Oh");
  });

  test("returns a response for nonexistent card (may render fallback)", async () => {
    const res = await req(`/pokeproxy/svg/${NONEXISTENT_CARD}`);
    // Template renderer may produce a fallback SVG or error — either way, not auth-blocked
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});

describe("POST /pokeproxy/svg/:cardId/regenerate", () => {
  test("no-op regenerate works without auth", async () => {
    const res = await postJson(`/pokeproxy/svg/${MOCK_CARD_ID}/regenerate`, {});
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cardId).toBe(MOCK_CARD_ID);
    expect(body.status).toBe("regenerated");
  });
});

// =========================================================================
// Prompt endpoints
// =========================================================================

describe("GET /pokeproxy/prompt/:cardId", () => {
  test("returns prompt info without auth", async () => {
    const res = await req(`/pokeproxy/prompt/${MOCK_CARD_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cardId).toBe(MOCK_CARD_ID);
    expect(typeof body.ruleName).toBe("string");
    expect(typeof body.skip).toBe("boolean");
  });
});

describe("PUT /pokeproxy/prompt/:cardId (requireAuthorized)", () => {
  test("401 without session", async () => {
    const res = await putJson(`/pokeproxy/prompt/${MOCK_CARD_ID}`, { prompt: "test" });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("403 for free-tier user", async () => {
    const res = await putJson(`/pokeproxy/prompt/${MOCK_CARD_ID}`, { prompt: "test" }, freeSession);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Authorized");
  });

  test("400 for missing prompt body", async () => {
    const res = await putJson(`/pokeproxy/prompt/${MOCK_CARD_ID}`, {}, authorizedSession);
    expect(res.status).toBe(400);
  });

  test("400 for non-string prompt", async () => {
    const res = await putJson(`/pokeproxy/prompt/${MOCK_CARD_ID}`, { prompt: 12345 }, authorizedSession);
    expect(res.status).toBe(400);
  });

  test("succeeds for authorized user", async () => {
    const res = await putJson(
      `/pokeproxy/prompt/${MOCK_CARD_ID}`,
      { prompt: "A blazing phoenix rising" },
      authorizedSession,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("saved");
  });

  test("succeeds for admin user", async () => {
    const res = await putJson(
      `/pokeproxy/prompt/${MOCK_CARD_ID}`,
      { prompt: "Admin override prompt" },
      adminSession,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("saved");
  });
});

// =========================================================================
// Generate endpoint (requireAuthorized) — no ComfyUI, so tests hit
// the skip/no_prompt/already_exists paths, not actual generation.
// =========================================================================

describe("POST /pokeproxy/generate/:cardId (requireAuthorized)", () => {
  test("401 without session", async () => {
    const res = await postJson(`/pokeproxy/generate/${MOCK_CARD_ID}`, {});
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("403 for free-tier user", async () => {
    const res = await postJson(`/pokeproxy/generate/${MOCK_CARD_ID}`, {}, freeSession);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Authorized");
  });

  test("401 with invalid session cookie", async () => {
    const res = await postJson(`/pokeproxy/generate/${MOCK_CARD_ID}`, {}, "bogus-session-id");
    expect(res.status).toBe(401);
  });

  test("authorized user — already_exists path", async () => {
    // Write a fake composite so the endpoint returns early without hitting ComfyUI
    writeFileSync(join(CACHE_DIR, `${MOCK_CARD_ID}_composite.png`), TINY_PNG);
    const res = await postJson(`/pokeproxy/generate/${MOCK_CARD_ID}`, {}, authorizedSession);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("already_exists");
    // Clean up so other tests aren't affected
    unlinkSync(join(CACHE_DIR, `${MOCK_CARD_ID}_composite.png`));
  });

  test("admin user — already_exists path", async () => {
    writeFileSync(join(CACHE_DIR, `${MOCK_CARD_ID}_composite.png`), TINY_PNG);
    const res = await postJson(`/pokeproxy/generate/${MOCK_CARD_ID}`, {}, adminSession);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("already_exists");
    unlinkSync(join(CACHE_DIR, `${MOCK_CARD_ID}_composite.png`));
  });

  test("returns 400 for nonexistent card (no image)", async () => {
    const res = await postJson(`/pokeproxy/generate/${NONEXISTENT_CARD}`, {}, authorizedSession);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("not loaded");
  });
});

// =========================================================================
// Card settings endpoints (requireAuth / requireAuthorized)
// =========================================================================

describe("GET /pokeproxy/settings/:cardId (requireAuth)", () => {
  test("401 without session", async () => {
    const res = await req(`/pokeproxy/settings/${MOCK_CARD_ID}`);
    expect(res.status).toBe(401);
  });

  test("any logged-in user can read settings (including free)", async () => {
    const res = await req(`/pokeproxy/settings/${MOCK_CARD_ID}`, { session: freeSession });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe("object");
  });
});

describe("PUT /pokeproxy/settings/:cardId (requireAuthorized)", () => {
  test("401 without session", async () => {
    const res = await putJson(`/pokeproxy/settings/${MOCK_CARD_ID}`, { fontSize: 20 });
    expect(res.status).toBe(401);
  });

  test("403 for free-tier user", async () => {
    const res = await putJson(`/pokeproxy/settings/${MOCK_CARD_ID}`, { fontSize: 20 }, freeSession);
    expect(res.status).toBe(403);
  });

  test("succeeds for authorized user", async () => {
    const res = await putJson(
      `/pokeproxy/settings/${MOCK_CARD_ID}`,
      { fontSize: 22 },
      authorizedSession,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fontSize).toBe(22);
  });

  test("authorized user can read back saved settings", async () => {
    const res = await req(`/pokeproxy/settings/${MOCK_CARD_ID}`, { session: authorizedSession });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fontSize).toBe(22);
  });
});

describe("DELETE /pokeproxy/settings/:cardId (requireAuth)", () => {
  test("401 without session", async () => {
    const res = await del(`/pokeproxy/settings/${MOCK_CARD_ID}`);
    expect(res.status).toBe(401);
  });

  test("logged-in user can delete their own settings", async () => {
    // First save a setting, then delete it
    await putJson(`/pokeproxy/settings/${MOCK_CARD_ID}`, { fontSize: 18 }, authorizedSession);
    const res = await del(`/pokeproxy/settings/${MOCK_CARD_ID}`, authorizedSession);
    expect(res.status).toBe(200);
  });
});

// =========================================================================
// Customized cards endpoints
// =========================================================================

describe("GET /pokeproxy/customized", () => {
  test("works without auth (user-agnostic)", async () => {
    const res = await req("/pokeproxy/customized");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.cards)).toBe(true);
  });
});

describe("DELETE /pokeproxy/customized/:cardId (requireAuthorized)", () => {
  test("401 without session", async () => {
    const res = await del(`/pokeproxy/customized/${MOCK_CARD_ID}`);
    expect(res.status).toBe(401);
  });

  test("403 for free-tier user", async () => {
    const res = await del(`/pokeproxy/customized/${MOCK_CARD_ID}`, freeSession);
    expect(res.status).toBe(403);
  });

  test("succeeds for authorized user (even if nothing to delete)", async () => {
    const res = await del(`/pokeproxy/customized/${NONEXISTENT_CARD}`, authorizedSession);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

describe("POST /pokeproxy/customized/batch/delete (requireAuthorized)", () => {
  test("401 without session", async () => {
    const res = await postJson("/pokeproxy/customized/batch/delete", { cardIds: [] });
    expect(res.status).toBe(401);
  });

  test("403 for free-tier user", async () => {
    const res = await postJson("/pokeproxy/customized/batch/delete", { cardIds: [] }, freeSession);
    expect(res.status).toBe(403);
  });

  test("succeeds for authorized user", async () => {
    const res = await postJson(
      "/pokeproxy/customized/batch/delete",
      { cardIds: [NONEXISTENT_CARD] },
      authorizedSession,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.deleted).toBe(1);
  });
});

// =========================================================================
// Error response format consistency
// =========================================================================

describe("error response format", () => {
  test("401 responses include error field", async () => {
    const endpoints = [
      () => postJson(`/pokeproxy/generate/${MOCK_CARD_ID}`, {}),
      () => putJson(`/pokeproxy/prompt/${MOCK_CARD_ID}`, { prompt: "x" }),
      () => putJson(`/pokeproxy/settings/${MOCK_CARD_ID}`, { fontSize: 20 }),
      () => del(`/pokeproxy/customized/${MOCK_CARD_ID}`),
      () => postJson("/pokeproxy/customized/batch/delete", { cardIds: [] }),
    ];
    for (const call of endpoints) {
      const res = await call();
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBeTruthy();
    }
  });

  test("403 responses include error field", async () => {
    const endpoints = [
      () => postJson(`/pokeproxy/generate/${MOCK_CARD_ID}`, {}, freeSession),
      () => putJson(`/pokeproxy/prompt/${MOCK_CARD_ID}`, { prompt: "x" }, freeSession),
      () => putJson(`/pokeproxy/settings/${MOCK_CARD_ID}`, { fontSize: 20 }, freeSession),
      () => del(`/pokeproxy/customized/${MOCK_CARD_ID}`, freeSession),
      () => postJson("/pokeproxy/customized/batch/delete", { cardIds: [] }, freeSession),
    ];
    for (const call of endpoints) {
      const res = await call();
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBeTruthy();
    }
  });
});

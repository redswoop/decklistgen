import { describe, it, expect, beforeEach, afterEach } from "bun:test";

// The api `get` helper resolves URLs against window.location.origin. Ensure it
// exists (and has a location) regardless of what other test files set up.
{
  const g = globalThis as { window?: { location?: { origin?: string } } };
  if (!g.window) g.window = {};
  if (!g.window.location) g.window.location = { origin: "http://localhost" };
}

import { useActingAs } from "./useActingAs.js";
import { api } from "../lib/client.js";
import type { AdminUser } from "../../shared/types/user.js";

const TARGET: AdminUser = {
  id: "user-123",
  email: "target@test.local",
  displayName: "Target User",
  isAdmin: false,
  isAuthorized: true,
  createdAt: "",
  updatedAt: "",
  hasPassword: true,
};

// Capture the headers of the most recent fetch.
let lastUrl = "";
let lastHeaders: Headers;
const realFetch = globalThis.fetch;

beforeEach(() => {
  // Always start from a clean (self) state.
  useActingAs().clearActingAs();
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    lastUrl = url.toString();
    lastHeaders = new Headers(init?.headers);
    return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  useActingAs().clearActingAs();
});

describe("useActingAs state", () => {
  it("starts not acting-as", () => {
    const { isActingAs, actingAsUserId } = useActingAs();
    expect(isActingAs.value).toBe(false);
    expect(actingAsUserId.value).toBeNull();
  });

  it("setActingAs / clearActingAs toggle state", () => {
    const a = useActingAs();
    a.setActingAs(TARGET);
    expect(a.isActingAs.value).toBe(true);
    expect(a.actingAsUserId.value).toBe(TARGET.id);
    expect(a.actingAsUser.value?.displayName).toBe("Target User");

    a.clearActingAs();
    expect(a.isActingAs.value).toBe(false);
    expect(a.actingAsUserId.value).toBeNull();
    expect(a.actingAsUser.value).toBeNull();
  });
});

describe("act-as header injection in the api client", () => {
  it("attaches X-Act-As-User to deck calls when acting-as", async () => {
    useActingAs().setActingAs(TARGET);
    await api.listDecks();
    expect(lastUrl).toContain("/decks");
    expect(lastHeaders.get("X-Act-As-User")).toBe(TARGET.id);
  });

  it("does NOT attach the header when not acting-as", async () => {
    await api.listDecks();
    expect(lastHeaders.get("X-Act-As-User")).toBeNull();
  });

  it("does NOT attach the header to non-deck calls (public decks)", async () => {
    useActingAs().setActingAs(TARGET);
    await api.listPublicDecks();
    expect(lastUrl).toContain("/public/decks");
    expect(lastHeaders.get("X-Act-As-User")).toBeNull();
  });

  it("does NOT attach the header to admin calls", async () => {
    useActingAs().setActingAs(TARGET);
    await api.listUsers();
    expect(lastUrl).toContain("/admin/users");
    expect(lastHeaders.get("X-Act-As-User")).toBeNull();
  });
});

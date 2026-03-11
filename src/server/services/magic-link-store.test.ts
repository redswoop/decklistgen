import { describe, test, expect, beforeEach, afterAll } from "bun:test";
import { createMagicLink, findMagicLink, redeemMagicLink, listMagicLinks, deleteMagicLink } from "./magic-link-store.js";
import { createUser } from "./user-store.js";
import { getDb } from "./db/database.js";

const TEST_EMAIL = `admin-${crypto.randomUUID()}@example.com`;
const INVITE_EMAIL = `invite-${crypto.randomUUID()}@example.com`;
let adminId: string;

beforeEach(async () => {
  getDb().query("DELETE FROM magic_links WHERE email = ?").run(INVITE_EMAIL);
  // Ensure admin exists
  const existing = getDb().query("SELECT id FROM users WHERE email = ?").get(TEST_EMAIL.toLowerCase()) as { id: string } | null;
  if (existing) {
    adminId = existing.id;
  } else {
    const admin = await createUser({ email: TEST_EMAIL, password: "adminpass123", displayName: "Admin", isAdmin: true });
    adminId = admin.id;
  }
});

afterAll(() => {
  getDb().query("DELETE FROM magic_links WHERE email = ?").run(INVITE_EMAIL);
  getDb().query("DELETE FROM users WHERE email = ?").run(TEST_EMAIL.toLowerCase());
});

describe("magic-link-store", () => {
  test("createMagicLink creates a link and returns it", () => {
    const link = createMagicLink({
      email: INVITE_EMAIL,
      displayName: "New User",
      isAuthorized: true,
      createdBy: adminId,
    });
    expect(link.token).toBeTruthy();
    expect(link.token.length).toBe(64); // 32 bytes hex
    expect(link.email).toBe(INVITE_EMAIL.toLowerCase());
    expect(link.displayName).toBe("New User");
    expect(link.isAuthorized).toBe(true);
    expect(link.isAdmin).toBe(false);
    expect(link.usedAt).toBeNull();
  });

  test("findMagicLink retrieves a link by token", () => {
    const link = createMagicLink({
      email: INVITE_EMAIL,
      displayName: "Find Me",
      createdBy: adminId,
    });
    const found = findMagicLink(link.token);
    expect(found).not.toBeNull();
    expect(found!.displayName).toBe("Find Me");
  });

  test("findMagicLink returns null for nonexistent token", () => {
    expect(findMagicLink("nonexistent")).toBeNull();
  });

  test("redeemMagicLink marks the link as used", () => {
    const link = createMagicLink({
      email: INVITE_EMAIL,
      displayName: "Redeem Me",
      createdBy: adminId,
    });
    const redeemed = redeemMagicLink(link.token);
    expect(redeemed).not.toBeNull();
    expect(redeemed!.usedAt).toBeTruthy();

    // Can't redeem again
    expect(redeemMagicLink(link.token)).toBeNull();
  });

  test("redeemMagicLink rejects expired links", () => {
    const link = createMagicLink({
      email: INVITE_EMAIL,
      displayName: "Expired",
      createdBy: adminId,
    });
    // Manually expire it
    getDb()
      .query("UPDATE magic_links SET expires_at = ? WHERE token = ?")
      .run(new Date(Date.now() - 1000).toISOString(), link.token);

    expect(redeemMagicLink(link.token)).toBeNull();
  });

  test("listMagicLinks returns all links", () => {
    createMagicLink({ email: INVITE_EMAIL, displayName: "L1", createdBy: adminId });
    const links = listMagicLinks();
    expect(links.length).toBeGreaterThan(0);
  });

  test("deleteMagicLink removes unused link", () => {
    const link = createMagicLink({
      email: INVITE_EMAIL,
      displayName: "Delete Me",
      createdBy: adminId,
    });
    expect(deleteMagicLink(link.token)).toBe(true);
    expect(findMagicLink(link.token)).toBeNull();
  });

  test("deleteMagicLink won't remove used link", () => {
    const link = createMagicLink({
      email: INVITE_EMAIL,
      displayName: "Used",
      createdBy: adminId,
    });
    redeemMagicLink(link.token);
    expect(deleteMagicLink(link.token)).toBe(false);
  });
});

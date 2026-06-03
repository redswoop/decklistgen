import { describe, it, expect } from "bun:test";
import { linkStatus } from "./magic-link-status.js";
import type { MagicLink } from "../../shared/types/user.js";

function link(overrides: Partial<MagicLink>): MagicLink {
  return {
    token: "tok",
    email: "a@b.com",
    displayName: "A",
    isAuthorized: true,
    isAdmin: false,
    expiresAt: "2030-01-01T00:00:00.000Z",
    usedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as MagicLink;
}

const NOW = new Date("2026-06-01T00:00:00.000Z");

describe("linkStatus", () => {
  it("is 'used' once consumed, regardless of expiry", () => {
    expect(linkStatus(link({ usedAt: "2026-05-01T00:00:00.000Z", expiresAt: "2026-01-01T00:00:00.000Z" }), NOW)).toBe("used");
  });

  it("is 'expired' when past expiry and unused", () => {
    expect(linkStatus(link({ expiresAt: "2026-05-01T00:00:00.000Z" }), NOW)).toBe("expired");
  });

  it("is 'pending' when unused and not yet expired", () => {
    expect(linkStatus(link({ expiresAt: "2026-07-01T00:00:00.000Z" }), NOW)).toBe("pending");
  });
});

import { describe, test, expect } from "bun:test";
import { normalizeServerUrl, parseSessionCookie, RemoteSyncError } from "./deck-sync.js";

describe("normalizeServerUrl", () => {
  test("strips trailing slash", () => {
    expect(normalizeServerUrl("https://example.com/")).toBe("https://example.com");
    expect(normalizeServerUrl("https://example.com///")).toBe("https://example.com");
  });

  test("preserves trailing slash on subpaths but strips the very end", () => {
    expect(normalizeServerUrl("https://example.com/decklist/")).toBe("https://example.com/decklist");
  });

  test("prepends https:// when missing", () => {
    expect(normalizeServerUrl("example.com")).toBe("https://example.com");
    expect(normalizeServerUrl("example.com:8080")).toBe("https://example.com:8080");
  });

  test("preserves http:// when given", () => {
    expect(normalizeServerUrl("http://localhost:3002")).toBe("http://localhost:3002");
  });

  test("rejects empty input", () => {
    expect(() => normalizeServerUrl("")).toThrow(RemoteSyncError);
    expect(() => normalizeServerUrl("   ")).toThrow(RemoteSyncError);
  });

  test("rejects malformed URLs", () => {
    expect(() => normalizeServerUrl("http://")).toThrow(RemoteSyncError);
  });

  test("rejects self-URL based on PORT env var", () => {
    const prevPort = process.env.PORT;
    process.env.PORT = "3001";
    try {
      expect(() => normalizeServerUrl("http://localhost:3001")).toThrow(/itself/);
      expect(() => normalizeServerUrl("http://127.0.0.1:3001")).toThrow(/itself/);
      // Different port → allowed
      expect(normalizeServerUrl("http://localhost:3002")).toBe("http://localhost:3002");
    } finally {
      if (prevPort === undefined) delete process.env.PORT;
      else process.env.PORT = prevPort;
    }
  });
});

describe("parseSessionCookie", () => {
  test("extracts session= value with attributes", () => {
    const header = "session=abc123; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000";
    expect(parseSessionCookie(header)).toBe("session=abc123");
  });

  test("extracts session= value when other cookies are present", () => {
    const header = "other=foo; Path=/, session=xyz789; HttpOnly";
    expect(parseSessionCookie(header)).toBe("session=xyz789");
  });

  test("returns null for null header", () => {
    expect(parseSessionCookie(null)).toBeNull();
  });

  test("returns null when no session cookie is present", () => {
    expect(parseSessionCookie("other=foo; Path=/")).toBeNull();
  });

  test("does not match cookie names that merely contain 'session'", () => {
    expect(parseSessionCookie("mysession=foo; Path=/")).toBeNull();
  });
});

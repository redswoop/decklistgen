import { describe, it, expect } from "bun:test";
import { parseMaxUses } from "./invite-code-form.js";

describe("parseMaxUses", () => {
  it("treats blank as unlimited (null)", () => {
    expect(parseMaxUses("")).toEqual({ ok: true, value: null });
    expect(parseMaxUses("   ")).toEqual({ ok: true, value: null });
  });

  it("accepts a positive integer", () => {
    expect(parseMaxUses("5")).toEqual({ ok: true, value: 5 });
    expect(parseMaxUses(" 12 ")).toEqual({ ok: true, value: 12 });
  });

  it("rejects zero, negatives, and non-numbers", () => {
    expect(parseMaxUses("0").ok).toBe(false);
    expect(parseMaxUses("-3").ok).toBe(false);
    expect(parseMaxUses("abc").ok).toBe(false);
  });
});

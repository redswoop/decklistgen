import { describe, test, expect } from "bun:test";
import { needsEvolveFromFallback } from "./card-detail.js";

describe("needsEvolveFromFallback", () => {
  test("Stage 1/2 with no evolveFrom needs inference", () => {
    expect(needsEvolveFromFallback("Stage1", undefined)).toBe(true);
    expect(needsEvolveFromFallback("Stage2", "")).toBe(true);
    expect(needsEvolveFromFallback("stage2", undefined)).toBe(true);
  });

  test("Basics and already-populated cards do not", () => {
    expect(needsEvolveFromFallback("Basic", undefined)).toBe(false);
    expect(needsEvolveFromFallback(undefined, undefined)).toBe(false);
    expect(needsEvolveFromFallback("Stage1", "Dreepy")).toBe(false);
  });
});

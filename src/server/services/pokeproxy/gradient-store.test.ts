import { describe, test, expect } from "bun:test";
import { getGradient } from "./gradient-store.js";

describe("gradient-store", () => {
  test("loads ribbon gradient from data/gradients.json", () => {
    const ribbon = getGradient("ribbon");
    expect(ribbon).toBeDefined();
    expect(ribbon!.x1).toBe(0);
    expect(ribbon!.x2).toBe(1);
    expect(ribbon!.stops.length).toBeGreaterThan(0);
    expect(ribbon!.stops[0].opacity).toBe(0.55);
  });

  test("returns undefined for unknown gradient name", () => {
    const nope = getGradient("nonexistent");
    expect(nope).toBeUndefined();
  });
});

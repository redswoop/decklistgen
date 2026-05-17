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

  test("ribbon stops have no explicit color (legacy single-color form)", () => {
    const ribbon = getGradient("ribbon");
    expect(ribbon).toBeDefined();
    expect(ribbon!.stops[0].color).toBeUndefined();
  });

  test("loads ability-pill-gold-red with per-stop colors", () => {
    const pill = getGradient("ability-pill-gold-red");
    expect(pill).toBeDefined();
    expect(pill!.stops.length).toBe(4);
    expect(pill!.stops[0].color).toBe("#f6d96b");
    expect(pill!.stops[3].color).toBe("#7a1a0f");
  });

  test("loads metallic-trainer-supporter", () => {
    const grad = getGradient("metallic-trainer-supporter");
    expect(grad).toBeDefined();
    expect(grad!.stops.length).toBe(3);
    expect(grad!.stops[1].color).toBe("#d44820");
  });

  test("loads all metallic name-plate variants", () => {
    expect(getGradient("metallic-name-plate-ex")).toBeDefined();
    expect(getGradient("metallic-name-plate-v")).toBeDefined();
    expect(getGradient("metallic-name-plate-vmax")).toBeDefined();
    expect(getGradient("metallic-name-plate-vstar")).toBeDefined();
  });
});

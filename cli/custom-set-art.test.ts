import { describe, test, expect } from "bun:test";
import sharp from "sharp";
import { composeCardArt, composeGeneratedArt, rasterize } from "./custom-set-art.js";

const CRITTER = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 130"><circle cx="100" cy="80" r="40" fill="#f00"/></svg>`;

describe("custom-set-art", () => {
  test("composeCardArt renders the critter on a 750×1050 backdrop with the banner", async () => {
    const svg = composeCardArt(CRITTER, "Fire", { banner: "Getting Heated", caption: "Play it early", meter: ["Warm", "Hot"] });
    expect(svg).toContain("GETTING HEATED");
    expect(svg).toContain("Play it early");
    expect(svg).toContain("WARM");
    const meta = await sharp(rasterize(svg)).metadata();
    expect([meta.width, meta.height]).toEqual([750, 1050]);
  });

  test("composeCardArt honours the layout overrides and ground band", () => {
    const svg = composeCardArt(CRITTER, "Water", {}, { critterTop: 20, critterWidth: 690, groundFrom: 430 });
    expect(svg).toContain('y="20" width="690"');
    expect(svg).toContain('y="430"');
    expect(svg).not.toContain("<text");
  });

  test("composeGeneratedArt cover-resizes a generated image and stamps the banner", async () => {
    const gen = await sharp({ create: { width: 848, height: 1168, channels: 3, background: "#2d8fd5" } }).png().toBuffer();
    const out = await composeGeneratedArt(gen, { banner: "Retreat", caption: "I need space" });
    const meta = await sharp(out).metadata();
    expect([meta.width, meta.height]).toEqual([750, 1050]);
    // The banner band darkens the strip at y≈160; the art below it is untouched blue.
    const { data } = await sharp(out).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const px = (x: number, y: number) => [data[(y * 750 + x) * 3], data[(y * 750 + x) * 3 + 1], data[(y * 750 + x) * 3 + 2]];
    expect(px(600, 160)[2]).toBeLessThan(0xd5 - 40);
    expect(px(375, 700)).toEqual([0x2d, 0x8f, 0xd5]);
  });
});

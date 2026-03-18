import { describe, test, expect } from "bun:test";
import sharp from "sharp";
import { analyzeImageBrightness } from "./image-brightness.js";

describe("analyzeImageBrightness", () => {
  test("pure white image returns ~1.0", async () => {
    const buf = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 255, b: 255 } },
    }).png().toBuffer();

    const brightness = await analyzeImageBrightness(buf);
    expect(brightness).toBeGreaterThan(0.95);
  });

  test("pure black image returns ~0.0", async () => {
    const buf = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 0, g: 0, b: 0 } },
    }).png().toBuffer();

    const brightness = await analyzeImageBrightness(buf);
    expect(brightness).toBeLessThan(0.05);
  });

  test("mid-gray image returns ~0.5", async () => {
    const buf = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 128, g: 128, b: 128 } },
    }).png().toBuffer();

    const brightness = await analyzeImageBrightness(buf);
    expect(brightness).toBeGreaterThan(0.4);
    expect(brightness).toBeLessThan(0.6);
  });

  test("bright pastel image returns high brightness", async () => {
    // Pastel pink — typical bright card background
    const buf = await sharp({
      create: { width: 750, height: 1050, channels: 3, background: { r: 255, g: 200, b: 220 } },
    }).png().toBuffer();

    const brightness = await analyzeImageBrightness(buf);
    expect(brightness).toBeGreaterThan(0.6);
  });

  test("dark card image returns low brightness", async () => {
    // Dark blue-black — typical dark card background
    const buf = await sharp({
      create: { width: 750, height: 1050, channels: 3, background: { r: 20, g: 20, b: 40 } },
    }).png().toBuffer();

    const brightness = await analyzeImageBrightness(buf);
    expect(brightness).toBeLessThan(0.1);
  });

  test("samples only bottom 40% of image", async () => {
    // Top 60% bright, bottom 40% dark — result should reflect bottom portion
    const width = 100;
    const height = 100;
    const channels = 3;
    const raw = Buffer.alloc(width * height * channels);

    // Top 60 rows = white, bottom 40 rows = black
    for (let y = 0; y < 60; y++) {
      for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * channels;
        raw[offset] = 255;
        raw[offset + 1] = 255;
        raw[offset + 2] = 255;
      }
    }
    // Bottom 40 rows stay black (buffer initialized to 0)

    const buf = await sharp(raw, { raw: { width, height, channels } }).png().toBuffer();
    const brightness = await analyzeImageBrightness(buf);
    // Should be close to 0 since we sample the bottom 40% which is all black
    expect(brightness).toBeLessThan(0.15);
  });
});

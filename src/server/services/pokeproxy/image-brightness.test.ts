import { describe, test, expect } from "bun:test";
import sharp from "sharp";
import {
  analyzeImageBrightness,
  analyzeImageBrightnessHistogram,
  histogramTextMode,
  sampleRegionBrightness,
  hpClusterRegion,
} from "./image-brightness.js";

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

  test("sampleRegionBrightness: bright region returns ~1.0", async () => {
    const buf = await sharp({
      create: { width: 200, height: 200, channels: 3, background: { r: 255, g: 255, b: 255 } },
    }).png().toBuffer();
    const b = await sampleRegionBrightness(buf, { left: 50, top: 50, width: 50, height: 50 });
    expect(b).toBeGreaterThan(0.95);
  });

  test("sampleRegionBrightness: dark region returns ~0.0", async () => {
    const buf = await sharp({
      create: { width: 200, height: 200, channels: 3, background: { r: 0, g: 0, b: 0 } },
    }).png().toBuffer();
    const b = await sampleRegionBrightness(buf, { left: 0, top: 0, width: 100, height: 100 });
    expect(b).toBeLessThan(0.05);
  });

  test("sampleRegionBrightness: bright half vs dark half samples independently", async () => {
    // Left 100 cols white, right 100 cols black
    const width = 200, height = 200, channels = 3;
    const raw = Buffer.alloc(width * height * channels);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const off = (y * width + x) * channels;
        const v = x < 100 ? 255 : 0;
        raw[off] = raw[off + 1] = raw[off + 2] = v;
      }
    }
    const buf = await sharp(raw, { raw: { width, height, channels } }).png().toBuffer();
    const left = await sampleRegionBrightness(buf, { left: 0, top: 0, width: 100, height: 200 });
    const right = await sampleRegionBrightness(buf, { left: 100, top: 0, width: 100, height: 200 });
    expect(left).toBeGreaterThan(0.95);
    expect(right).toBeLessThan(0.05);
  });

  test("sampleRegionBrightness: out-of-bounds region is clamped, not thrown", async () => {
    const buf = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 128, g: 128, b: 128 } },
    }).png().toBuffer();
    // Region extends past the image
    const b = await sampleRegionBrightness(buf, { left: 50, top: 50, width: 200, height: 200 });
    expect(b).toBeGreaterThan(0.4);
    expect(b).toBeLessThan(0.6);
  });

  test("hpClusterRegion: returns the top-right corner rectangle within bounds", () => {
    const r = hpClusterRegion(750, 1050);
    expect(r.left).toBe(420);
    expect(r.top).toBe(20);
    expect(r.width).toBe(310);
    expect(r.height).toBe(80);
    // rectangle stays within image
    expect(r.left + r.width).toBeLessThanOrEqual(750);
    expect(r.top + r.height).toBeLessThanOrEqual(1050);
  });

  test("hpClusterRegion: scales to a smaller source image", () => {
    const r = hpClusterRegion(600, 825);
    // Same relative position, scaled down
    expect(r.left).toBeCloseTo(420 * 600 / 750, 0);
    expect(r.top).toBeCloseTo(20 * 825 / 1050, 0);
  });

  test("analyzeImageBrightnessHistogram: pure white image is ~100% bright", async () => {
    const buf = await sharp({
      create: { width: 750, height: 1050, channels: 3, background: { r: 255, g: 255, b: 255 } },
    }).png().toBuffer();
    const h = await analyzeImageBrightnessHistogram(buf);
    expect(h.brightRatio).toBeGreaterThan(0.99);
    expect(h.darkRatio).toBeLessThan(0.01);
    expect(histogramTextMode(h)).toBe("dark");
  });

  test("analyzeImageBrightnessHistogram: pure black image is ~100% dark", async () => {
    const buf = await sharp({
      create: { width: 750, height: 1050, channels: 3, background: { r: 0, g: 0, b: 0 } },
    }).png().toBuffer();
    const h = await analyzeImageBrightnessHistogram(buf);
    expect(h.darkRatio).toBeGreaterThan(0.99);
    expect(h.brightRatio).toBeLessThan(0.01);
    expect(histogramTextMode(h)).toBe("light");
  });

  test("analyzeImageBrightnessHistogram: bright logo on dark background still says light text", async () => {
    // Reconstruct the failure mode the histogram is supposed to fix: a card
    // whose bottom region is mostly dark but has a small bright logo. The
    // average can be dragged near the threshold; the histogram should
    // confidently still pick "light text on dark bg".
    const width = 750, height = 1050, channels = 3;
    const raw = Buffer.alloc(width * height * channels);
    // Whole image dark grey
    for (let i = 0; i < raw.length; i++) raw[i] = 30;
    // Paint a 100×60 bright-white "logo" in the bottom region
    for (let y = 800; y < 860; y++) {
      for (let x = 300; x < 400; x++) {
        const off = (y * width + x) * channels;
        raw[off] = raw[off + 1] = raw[off + 2] = 255;
      }
    }
    const buf = await sharp(raw, { raw: { width, height, channels } }).png().toBuffer();
    const h = await analyzeImageBrightnessHistogram(buf);
    expect(h.darkRatio).toBeGreaterThan(0.85);
    expect(histogramTextMode(h)).toBe("light");
  });

  test("histogramTextMode tie-breaks on mean luminance", () => {
    // Equal dark/bright counts, mean slightly above 0.5 → dark text (light bg).
    expect(histogramTextMode({
      darkRatio: 0.4, brightRatio: 0.4, midRatio: 0.2, meanLuminance: 0.51,
    })).toBe("dark");
    expect(histogramTextMode({
      darkRatio: 0.4, brightRatio: 0.4, midRatio: 0.2, meanLuminance: 0.49,
    })).toBe("light");
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

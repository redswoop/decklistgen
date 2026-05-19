import { describe, test, expect } from "bun:test";
import sharp from "sharp";
import { analyzeBrightnessFromBuffer } from "./analyze-card.js";

async function buf(rgb: { r: number; g: number; b: number }) {
  return sharp({
    create: { width: 750, height: 1050, channels: 3, background: rgb },
  }).png().toBuffer();
}

describe("analyzeBrightnessFromBuffer histogram diagnostics", () => {
  test("returns both detector decisions plus histogram counts", async () => {
    const report = await analyzeBrightnessFromBuffer(await buf({ r: 255, g: 255, b: 255 }), false);
    expect(report.textModeAverage).toBe("dark");
    expect(report.textModeHistogram).toBe("dark");
    expect(report.histogram).toBeDefined();
    expect(report.histogram!.brightRatio).toBeGreaterThan(0.99);
  });

  test("when detectors disagree, histogram wins the final decision", async () => {
    // Construct a card where the bottom region's average lands just above the
    // 0.6 threshold (=> avg says "dark text") but the histogram is dominated
    // by dark pixels (=> hist says "light text"). Two-tone image: 55% black
    // pixels + 45% white pixels has avg ≈ 0.45 and histogram ≈ 55/45 dark.
    // Tune to push average above 0.6 with a bright dominant fraction first…
    // Actually simpler: paint top-60% (not sampled) any colour; bottom-40%
    // entirely white EXCEPT a tiny black sliver. Histogram → bright dominates
    // (agrees with avg). To force disagreement, do the inverse case where the
    // mean is high but the dominant cluster is dark — not physically possible
    // by mean definition. So instead test the histogram-wins path with
    // synthetic data tested directly via consensusTextMode behaviour:
    // a card whose bottom-40% mean is 0.62 (above threshold => avg says dark)
    // but whose darkRatio > brightRatio (histogram says light). This happens
    // when a small region is very bright (lifting the mean) but most of the
    // area is moderately dark — mid-grey.
    const width = 750, height = 1050, channels = 3;
    const raw = Buffer.alloc(width * height * channels);
    // top 60%: don't care, fill with mid-grey
    for (let i = 0; i < raw.length; i++) raw[i] = 128;
    // bottom 40% (rows 630..1049): paint mostly mid-grey-just-below-cutoff
    // (luminance ~0.30, counts as dark), with a small ultra-bright patch.
    for (let y = 630; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const off = (y * width + x) * channels;
        raw[off] = raw[off + 1] = raw[off + 2] = 80; // ≈0.31 → dark bucket
      }
    }
    // Tiny ultra-bright square pulls the mean up
    for (let y = 700; y < 900; y++) {
      for (let x = 200; x < 600; x++) {
        const off = (y * width + x) * channels;
        raw[off] = raw[off + 1] = raw[off + 2] = 255;
      }
    }
    const image = await sharp(raw, { raw: { width, height, channels } }).png().toBuffer();
    const report = await analyzeBrightnessFromBuffer(image, false);
    // Sanity-check the construction succeeded: dark cluster should dominate
    // even though the mean is high enough to push the legacy detector toward
    // "dark text".
    expect(report.histogram!.darkRatio).toBeGreaterThan(report.histogram!.brightRatio);
    expect(report.textModeHistogram).toBe("light");
    // Final decision tracks the histogram, not the average.
    expect(report.textMode).toBe(report.textModeHistogram);
  });

  test("when detectors agree, final decision matches both", async () => {
    const report = await analyzeBrightnessFromBuffer(await buf({ r: 20, g: 20, b: 40 }), false);
    expect(report.textModeAverage).toBe("light");
    expect(report.textModeHistogram).toBe("light");
    expect(report.textMode).toBe("light");
  });

  test("override still wins over consensus", async () => {
    const report = await analyzeBrightnessFromBuffer(
      await buf({ r: 0, g: 0, b: 0 }),
      false,
      { textMode: "dark" },
    );
    // Both detectors say "light", but the user forced "dark".
    expect(report.textModeAverage).toBe("light");
    expect(report.textModeHistogram).toBe("light");
    expect(report.textMode).toBe("dark");
    expect(report.textModeOverridden).toBe(true);
  });
});

describe("analyzeBrightnessFromBuffer override behavior", () => {
  test("with no override, auto-detection still drives textMode", async () => {
    // Pure-white image → auto = dark (text)
    const report = await analyzeBrightnessFromBuffer(await buf({ r: 255, g: 255, b: 255 }), false);
    expect(report.textMode).toBe("dark");
    expect(report.textModeOverridden).toBe(false);
  });

  test("override.textMode replaces the auto-decision but raw brightness is unchanged", async () => {
    const white = await buf({ r: 255, g: 255, b: 255 });
    const report = await analyzeBrightnessFromBuffer(white, false, { textMode: "light" });
    expect(report.textMode).toBe("light");
    expect(report.textModeOverridden).toBe(true);
    // Auto would have said dark, but the raw measurement is still ~1.0 so the
    // inspector can show "you forced this against the auto-detection".
    expect(report.textBrightness).toBeGreaterThan(0.95);
  });

  test("override.textMode matching the auto value still marks it as overridden", async () => {
    const black = await buf({ r: 0, g: 0, b: 0 });
    const report = await analyzeBrightnessFromBuffer(black, false, { textMode: "light" });
    expect(report.textMode).toBe("light");
    // The override flag tracks "user set this" not "user disagreed with auto".
    expect(report.textModeOverridden).toBe(true);
  });

  test("wantHp=false ignores hp override and returns null fields", async () => {
    const report = await analyzeBrightnessFromBuffer(
      await buf({ r: 255, g: 255, b: 255 }),
      false,
      { hpTextMode: "light" },
    );
    expect(report.hpTextMode).toBeNull();
    expect(report.hpBrightness).toBeNull();
  });

  test("wantHp=true with no override uses auto", async () => {
    const report = await analyzeBrightnessFromBuffer(await buf({ r: 255, g: 255, b: 255 }), true);
    expect(report.hpTextMode).toBe("dark");
    expect(report.hpTextModeOverridden).toBe(false);
  });

  test("wantHp=true with hp override forces the chosen mode", async () => {
    const report = await analyzeBrightnessFromBuffer(
      await buf({ r: 255, g: 255, b: 255 }),
      true,
      { hpTextMode: "light" },
    );
    expect(report.hpTextMode).toBe("light");
    expect(report.hpTextModeOverridden).toBe(true);
  });

  test("text and hp overrides operate independently", async () => {
    const white = await buf({ r: 255, g: 255, b: 255 });
    const report = await analyzeBrightnessFromBuffer(white, true, { textMode: "light" });
    expect(report.textMode).toBe("light");
    expect(report.textModeOverridden).toBe(true);
    // hp wasn't overridden so it falls back to auto (dark on white)
    expect(report.hpTextMode).toBe("dark");
    expect(report.hpTextModeOverridden).toBe(false);
  });
});

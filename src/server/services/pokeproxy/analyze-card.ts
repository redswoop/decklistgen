/** Card brightness analysis — extracted from render-svg.ts so the
 *  `/inspect/:cardId` API can return the same metrics the renderer uses to
 *  decide light-vs-dark text without duplicating the logic.
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import {
  analyzeImageBrightness,
  analyzeImageBrightnessHistogram,
  histogramTextMode,
  sampleRegionBrightness,
  hpClusterRegion,
  type BrightnessHistogram,
} from "./image-brightness.js";
import { cachePath, ensureSourceImage, ensureCardLoaded, loadCardData } from "./render-svg.js";
import { suggestTemplate } from "../../../shared/utils/suggest-template.js";
import { getTextModeOverride } from "./text-mode-store.js";
import type { TcgdexCard } from "../../../shared/types/card.js";
import type { TemplateName } from "../../../shared/utils/suggest-template.js";

export type TextMode = "dark" | "light";

export interface BrightnessReport {
  /** Final mode the renderer uses (after override + auto consensus). */
  textMode: TextMode;
  textBrightness: number;
  hpTextMode: TextMode | null;
  hpBrightness: number | null;
  /** Whether the returned textMode came from a user override. */
  textModeOverridden?: boolean;
  /** Whether the returned hpTextMode came from a user override. */
  hpTextModeOverridden?: boolean;
  /** What the legacy average-threshold detector would say. Kept on the report
   *  so the inspector can highlight when the new histogram-based detector
   *  disagrees with the old one. */
  textModeAverage?: TextMode;
  /** What the histogram detector says. */
  textModeHistogram?: TextMode;
  /** Histogram counts for the sampled region (bottom 40%). */
  histogram?: BrightnessHistogram;
}

/** Legacy threshold used when only the average is consulted (>0.6 ⇒ light bg). */
const BRIGHTNESS_THRESHOLD = 0.6;

/** Pick a final textMode by reconciling the average and the histogram. When
 *  they agree, the answer is obvious. When they disagree, prefer the
 *  histogram: it's specifically more robust to small bright/dark features that
 *  drag the mean across the threshold (the exact failure mode the histogram
 *  detector was introduced to fix).
 */
function consensusTextMode(avg: number, hist: BrightnessHistogram): TextMode {
  const avgMode: TextMode = avg > BRIGHTNESS_THRESHOLD ? "dark" : "light";
  const histMode = histogramTextMode(hist);
  if (avgMode === histMode) return avgMode;
  return histMode;
}

/** Analyze an in-memory image buffer. Pure helper — no disk reads, no card lookup.
 *
 *  @param imageBuffer  Decoded PNG bytes of the card image.
 *  @param wantHp       Whether to sample the HP-cluster region too (Pokemon templates only).
 *  @param override     Optional user-set mode override. Per-field: when set,
 *                      replaces the auto value but the raw brightness measurement
 *                      is still returned so the inspector can show both.
 */
export async function analyzeBrightnessFromBuffer(
  imageBuffer: Buffer,
  wantHp: boolean,
  override?: { textMode?: TextMode; hpTextMode?: TextMode },
): Promise<BrightnessReport> {
  // Run both detectors. The histogram extracts the same region as the average
  // detector, so the second call is the cost of a second pass over a 50×50
  // resize (≈2500 pixels), which is negligible compared to the I/O of loading
  // the source image.
  const [textBrightness, histogram] = await Promise.all([
    analyzeImageBrightness(imageBuffer),
    analyzeImageBrightnessHistogram(imageBuffer),
  ]);

  const textModeAverage: TextMode = textBrightness > BRIGHTNESS_THRESHOLD ? "dark" : "light";
  const textModeHistogram = histogramTextMode(histogram);
  const autoText = consensusTextMode(textBrightness, histogram);
  const textMode: TextMode = override?.textMode ?? autoText;

  if (!wantHp) {
    return {
      textMode,
      textBrightness,
      hpTextMode: null,
      hpBrightness: null,
      textModeOverridden: override?.textMode != null,
      textModeAverage,
      textModeHistogram,
      histogram,
    };
  }

  const sharpMod = (await import("sharp")).default;
  const meta = await sharpMod(imageBuffer).metadata();
  const region = hpClusterRegion(meta.width ?? 600, meta.height ?? 825);
  const hpBrightness = await sampleRegionBrightness(imageBuffer, region);
  const autoHp: TextMode = hpBrightness > BRIGHTNESS_THRESHOLD ? "dark" : "light";
  const hpTextMode: TextMode = override?.hpTextMode ?? autoHp;
  return {
    textMode,
    textBrightness,
    hpTextMode,
    hpBrightness,
    textModeOverridden: override?.textMode != null,
    hpTextModeOverridden: override?.hpTextMode != null,
    textModeAverage,
    textModeHistogram,
    histogram,
  };
}

export interface CardInspectionReport extends BrightnessReport {
  cardId: string;
  template: TemplateName;
  hasSource: boolean;
  hasClean: boolean;
  hasComposite: boolean;
  hasSvg: boolean;
}

/** Full inspection: load image (composite > clean > source), determine template,
 *  run the same brightness analysis the renderer uses. */
export async function inspectCard(cardId: string): Promise<CardInspectionReport> {
  // Pick best-available image (mirrors generateSvgFromTemplate)
  let imageBuffer: Buffer | null = null;
  let isProcessed = false;
  for (const suffix of ["_composite.png", "_clean.png", ".png"]) {
    const p = cachePath(cardId, suffix);
    if (existsSync(p)) {
      imageBuffer = await readFile(p);
      isProcessed = suffix !== ".png";
      break;
    }
  }
  if (!imageBuffer) {
    if (await ensureSourceImage(cardId)) {
      imageBuffer = await readFile(cachePath(cardId, ".png"));
    }
  }

  await ensureCardLoaded(cardId);
  const cardData = loadCardData(cardId);

  let template: TemplateName = suggestTemplate(cardData as unknown as TcgdexCard);
  if (template === "pokemon-standard" && isProcessed) template = "pokemon-fullart";

  const isPokemonTpl =
    template === "pokemon-fullart" ||
    template === "pokemon-vstar" ||
    template === "pokemon-standard";

  const override = getTextModeOverride(cardId);

  let brightness: BrightnessReport = {
    textMode: override.textMode ?? "light",
    textBrightness: 0,
    hpTextMode: override.hpTextMode ?? null,
    hpBrightness: null,
    textModeOverridden: override.textMode != null,
    hpTextModeOverridden: override.hpTextMode != null,
  };
  if (imageBuffer && (isPokemonTpl || template === "trainer")) {
    try {
      brightness = await analyzeBrightnessFromBuffer(imageBuffer, isPokemonTpl, override);
    } catch { /* leave default light-mode fallback */ }
  }

  return {
    cardId,
    template,
    hasSource: existsSync(cachePath(cardId, ".png")),
    hasClean: existsSync(cachePath(cardId, "_clean.png")),
    hasComposite: existsSync(cachePath(cardId, "_composite.png")),
    hasSvg: existsSync(cachePath(cardId, ".svg")),
    ...brightness,
  };
}

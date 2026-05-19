/** Card brightness analysis — extracted from render-svg.ts so the
 *  `/inspect/:cardId` API can return the same metrics the renderer uses to
 *  decide light-vs-dark text without duplicating the logic.
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import {
  analyzeImageBrightness,
  sampleRegionBrightness,
  hpClusterRegion,
} from "./image-brightness.js";
import { cachePath, ensureSourceImage, ensureCardLoaded, loadCardData } from "./render-svg.js";
import { suggestTemplate } from "../../../shared/utils/suggest-template.js";
import type { TcgdexCard } from "../../../shared/types/card.js";
import type { TemplateName } from "../../../shared/utils/suggest-template.js";

export type TextMode = "dark" | "light";

export interface BrightnessReport {
  textMode: TextMode;
  textBrightness: number;
  hpTextMode: TextMode | null;
  hpBrightness: number | null;
}

/** Threshold the renderer uses (>0.6 ⇒ background is light ⇒ text must be dark). */
const BRIGHTNESS_THRESHOLD = 0.6;

/** Analyze an in-memory image buffer. Pure helper — no disk reads, no card lookup.
 *
 *  @param imageBuffer  Decoded PNG bytes of the card image.
 *  @param wantHp       Whether to sample the HP-cluster region too (Pokemon templates only).
 */
export async function analyzeBrightnessFromBuffer(
  imageBuffer: Buffer,
  wantHp: boolean,
): Promise<BrightnessReport> {
  const textBrightness = await analyzeImageBrightness(imageBuffer);
  const textMode: TextMode = textBrightness > BRIGHTNESS_THRESHOLD ? "dark" : "light";

  if (!wantHp) {
    return { textMode, textBrightness, hpTextMode: null, hpBrightness: null };
  }

  const sharpMod = (await import("sharp")).default;
  const meta = await sharpMod(imageBuffer).metadata();
  const region = hpClusterRegion(meta.width ?? 600, meta.height ?? 825);
  const hpBrightness = await sampleRegionBrightness(imageBuffer, region);
  const hpTextMode: TextMode = hpBrightness > BRIGHTNESS_THRESHOLD ? "dark" : "light";
  return { textMode, textBrightness, hpTextMode, hpBrightness };
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

  let brightness: BrightnessReport = {
    textMode: "light",
    textBrightness: 0,
    hpTextMode: null,
    hpBrightness: null,
  };
  if (imageBuffer && (isPokemonTpl || template === "trainer")) {
    try {
      brightness = await analyzeBrightnessFromBuffer(imageBuffer, isPokemonTpl);
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

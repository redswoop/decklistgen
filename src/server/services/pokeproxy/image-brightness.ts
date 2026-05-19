/**
 * Image brightness analysis — determines whether text on a card
 * should be light or dark based on the background image luminance.
 *
 * Two analyzers are exposed:
 *   - `analyzeImageBrightness`: average BT.709 luminance of the bottom 40%.
 *     Cheap and simple, but a small bright element (e.g. a logo) over a dark
 *     background can drag the average across the threshold and flip the
 *     decision the wrong way.
 *   - `analyzeImageBrightnessHistogram`: counts how many pixels fall into
 *     "very dark" / "very bright" / "mid" buckets. More robust to local
 *     features because it asks "what does most of the area look like?".
 *
 * The consumer (analyze-card.ts) combines both into a single decision: when
 * they agree, that's the answer; when they disagree, the histogram wins
 * because that's the failure mode the histogram was designed to catch.
 */

import sharp from "sharp";

/** Histogram split points (in normalised 0–1 luminance). */
export const DARK_CUTOFF = 0.35;
export const BRIGHT_CUTOFF = 0.65;

/** Region the analyzers sample (bottom 40% of the card image). Exported so
 *  callers can keep diagnostic visualisations in lockstep with the analyzer. */
export function bottomTextRegion(imgW: number, imgH: number): {
  left: number; top: number; width: number; height: number;
} {
  const top = Math.round(imgH * 0.6);
  return { left: 0, top, width: imgW, height: imgH - top };
}

/**
 * Analyze the brightness of the bottom portion of an image (where the content block lives).
 * Returns a 0-1 value where 0 = black and 1 = white.
 * Uses BT.709 perceived luminance: 0.2126*R + 0.7152*G + 0.0722*B
 */
export async function analyzeImageBrightness(imageBuffer: Buffer): Promise<number> {
  const meta = await sharp(imageBuffer).metadata();
  const imgH = meta.height ?? 1050;
  const imgW = meta.width ?? 750;

  const region = bottomTextRegion(imgW, imgH);

  const { data, info } = await sharp(imageBuffer)
    .extract(region)
    .resize(50, 50, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = info.width * info.height;
  let totalLuminance = 0;

  for (let i = 0; i < pixels; i++) {
    const offset = i * info.channels;
    const r = data[offset] / 255;
    const g = data[offset + 1] / 255;
    const b = data[offset + 2] / 255;
    totalLuminance += 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  return totalLuminance / pixels;
}

export interface BrightnessHistogram {
  /** Fraction of sampled pixels with luminance < DARK_CUTOFF. */
  darkRatio: number;
  /** Fraction of sampled pixels with luminance > BRIGHT_CUTOFF. */
  brightRatio: number;
  /** Fraction in [DARK_CUTOFF, BRIGHT_CUTOFF]. */
  midRatio: number;
  /** Mean luminance of the sampled region (same input as
   *  analyzeImageBrightness — recomputed here to avoid a second extract pass). */
  meanLuminance: number;
}

/**
 * Bucket the bottom-40% pixels by luminance. This survives small bright/dark
 * features over an otherwise-uniform background because it asks "what does
 * most of the area look like?" rather than "what's the mean?".
 */
export async function analyzeImageBrightnessHistogram(
  imageBuffer: Buffer,
): Promise<BrightnessHistogram> {
  const meta = await sharp(imageBuffer).metadata();
  const imgH = meta.height ?? 1050;
  const imgW = meta.width ?? 750;

  const { data, info } = await sharp(imageBuffer)
    .extract(bottomTextRegion(imgW, imgH))
    .resize(50, 50, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = info.width * info.height;
  let dark = 0;
  let bright = 0;
  let mid = 0;
  let totalLuminance = 0;
  for (let i = 0; i < pixels; i++) {
    const offset = i * info.channels;
    const r = data[offset] / 255;
    const g = data[offset + 1] / 255;
    const b = data[offset + 2] / 255;
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    totalLuminance += y;
    if (y < DARK_CUTOFF) dark++;
    else if (y > BRIGHT_CUTOFF) bright++;
    else mid++;
  }
  return {
    darkRatio: dark / pixels,
    brightRatio: bright / pixels,
    midRatio: mid / pixels,
    meanLuminance: totalLuminance / pixels,
  };
}

export type TextMode = "dark" | "light";

/** Derive a textMode from a histogram. "dark" means "background is light, so
 *  text must be dark"; "light" means the opposite. */
export function histogramTextMode(h: BrightnessHistogram): TextMode {
  if (h.brightRatio > h.darkRatio) return "dark";
  if (h.darkRatio > h.brightRatio) return "light";
  // Tie on dark/bright counts — fall back to the mean.
  return h.meanLuminance > 0.5 ? "dark" : "light";
}

export type Region = { left: number; top: number; width: number; height: number };

/**
 * Sample average BT.709 luminance of a rectangular region.
 * Coordinates are in source-image pixels. The region is clamped to the
 * image bounds; an empty intersection returns 0.5 (neutral fallback).
 */
export async function sampleRegionBrightness(
  imageBuffer: Buffer,
  region: Region,
): Promise<number> {
  const meta = await sharp(imageBuffer).metadata();
  const imgW = meta.width ?? 0;
  const imgH = meta.height ?? 0;
  if (imgW === 0 || imgH === 0) return 0.5;

  const left = Math.max(0, Math.min(imgW - 1, Math.round(region.left)));
  const top = Math.max(0, Math.min(imgH - 1, Math.round(region.top)));
  const width = Math.max(1, Math.min(imgW - left, Math.round(region.width)));
  const height = Math.max(1, Math.min(imgH - top, Math.round(region.height)));

  const { data, info } = await sharp(imageBuffer)
    .extract({ left, top, width, height })
    .resize(25, 25, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = info.width * info.height;
  let totalLuminance = 0;
  for (let i = 0; i < pixels; i++) {
    const offset = i * info.channels;
    const r = data[offset] / 255;
    const g = data[offset + 1] / 255;
    const b = data[offset + 2] / 255;
    totalLuminance += 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  return totalLuminance / pixels;
}

/**
 * The HP cluster sits in the top-right corner of the card (around card
 * anchor 514×42 on a 750×1050 layout). Returns the source-image region
 * to sample, scaled from the card-space rectangle.
 */
export function hpClusterRegion(imgW: number, imgH: number): Region {
  const sx = imgW / 750;
  const sy = imgH / 1050;
  return {
    left:   Math.round(420 * sx),
    top:    Math.round(20  * sy),
    width:  Math.round(310 * sx),
    height: Math.round(80  * sy),
  };
}

/**
 * Image brightness analysis — determines whether text on a card
 * should be light or dark based on the background image luminance.
 */

import sharp from "sharp";

/**
 * Analyze the brightness of the bottom portion of an image (where the content block lives).
 * Returns a 0-1 value where 0 = black and 1 = white.
 * Uses BT.709 perceived luminance: 0.2126*R + 0.7152*G + 0.0722*B
 */
export async function analyzeImageBrightness(imageBuffer: Buffer): Promise<number> {
  const meta = await sharp(imageBuffer).metadata();
  const imgH = meta.height ?? 1050;
  const imgW = meta.width ?? 750;

  // Sample the bottom ~40% of the image (where the content block sits)
  const top = Math.round(imgH * 0.6);
  const regionH = imgH - top;

  const { data, info } = await sharp(imageBuffer)
    .extract({ left: 0, top, width: imgW, height: regionH })
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

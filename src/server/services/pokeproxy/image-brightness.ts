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

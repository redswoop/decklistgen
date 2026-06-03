import { cardImageUrl } from "../../shared/utils/card-image-url.js";
import type { CardVersion } from "../composables/useCardVersion.js";

interface ImageInputs {
  /** The cleaned/composite PNG URL, or null if none has been generated. */
  cleanedUrl: string | null;
  /** Whether a cleaned or composite image exists. */
  hasClean: boolean;
  /** The card's base image path (for the original scan), if any. */
  imageBase: string | undefined;
}

/**
 * Pick the main (large) lightbox image for the selected version:
 *   cleaned  — the cleaned PNG, or the original scan if none exists yet,
 *   proxy    — null when no clean exists (the generate CTA takes over); the CSS
 *              renderer overlays the clean art otherwise so the base is the scan,
 *   original — the original scan.
 */
export function resolveMainImageUrl(version: CardVersion, opts: ImageInputs): string | null {
  const high = opts.imageBase ? cardImageUrl(opts.imageBase, "high") : null;
  if (version === "cleaned") return opts.cleanedUrl ?? high;
  if (version === "proxy" && !opts.hasClean) return null;
  return high;
}

/** Pick the zoom-overlay image: the cleaned PNG in cleaned view, else the scan. */
export function resolveZoomImageUrl(
  version: CardVersion,
  opts: { cleanedUrl: string | null; imageBase: string | undefined },
): string {
  if (version === "cleaned" && opts.cleanedUrl) return opts.cleanedUrl;
  return cardImageUrl(opts.imageBase ?? "", "high");
}

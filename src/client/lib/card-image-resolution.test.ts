import { describe, it, expect } from "bun:test";
import { resolveMainImageUrl, resolveZoomImageUrl } from "./card-image-resolution.js";
import { cardImageUrl } from "../../shared/utils/card-image-url.js";

const BASE = "https://img/base";
const HIGH = cardImageUrl(BASE, "high");
const CLEAN = "https://img/clean.png";

describe("resolveMainImageUrl", () => {
  it("cleaned view uses the cleaned URL when present, else the scan", () => {
    expect(resolveMainImageUrl("cleaned", { cleanedUrl: CLEAN, hasClean: true, imageBase: BASE })).toBe(CLEAN);
    expect(resolveMainImageUrl("cleaned", { cleanedUrl: null, hasClean: false, imageBase: BASE })).toBe(HIGH);
    expect(resolveMainImageUrl("cleaned", { cleanedUrl: null, hasClean: false, imageBase: undefined })).toBeNull();
  });

  it("proxy view is null until a clean exists (CTA takes over)", () => {
    expect(resolveMainImageUrl("proxy", { cleanedUrl: null, hasClean: false, imageBase: BASE })).toBeNull();
    // With a clean, the base scan shows under the CSS overlay.
    expect(resolveMainImageUrl("proxy", { cleanedUrl: CLEAN, hasClean: true, imageBase: BASE })).toBe(HIGH);
  });

  it("original view is always the high-res scan", () => {
    expect(resolveMainImageUrl("original", { cleanedUrl: CLEAN, hasClean: true, imageBase: BASE })).toBe(HIGH);
    expect(resolveMainImageUrl("original", { cleanedUrl: null, hasClean: false, imageBase: undefined })).toBeNull();
  });
});

describe("resolveZoomImageUrl", () => {
  it("uses the cleaned URL only in cleaned view", () => {
    expect(resolveZoomImageUrl("cleaned", { cleanedUrl: CLEAN, imageBase: BASE })).toBe(CLEAN);
    expect(resolveZoomImageUrl("proxy", { cleanedUrl: CLEAN, imageBase: BASE })).toBe(HIGH);
    expect(resolveZoomImageUrl("original", { cleanedUrl: CLEAN, imageBase: BASE })).toBe(HIGH);
  });

  it("falls back to the scan when no cleaned URL", () => {
    expect(resolveZoomImageUrl("cleaned", { cleanedUrl: null, imageBase: BASE })).toBe(HIGH);
  });
});

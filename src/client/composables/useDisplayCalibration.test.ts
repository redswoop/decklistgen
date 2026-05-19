import { describe, test, expect, beforeEach } from "bun:test";

// Mock localStorage before importing the composable so module-level init
// (readStorage at import time) sees the mock.
const store: Record<string, string> = {};
globalThis.localStorage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, val: string) => { store[key] = val; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  length: 0,
  key: () => null,
};

// Minimal `window` stub for the DPR snapshot. The composable guards against
// missing window so this only needs to exist; matchMedia isn't required for
// these tests because we manipulate the reactive DPR through the test hook.
// @ts-ignore — partial window stub for bun:test
globalThis.window = { devicePixelRatio: 1 };

const {
  useDisplayCalibration,
  __setCurrentDevicePixelRatioForTest,
  CARD_WIDTH_IN,
  CARD_HEIGHT_IN,
} = await import("./useDisplayCalibration.js");

describe("useDisplayCalibration", () => {
  let cal: ReturnType<typeof useDisplayCalibration>;

  beforeEach(() => {
    localStorage.clear();
    cal = useDisplayCalibration();
    cal.reset();
    __setCurrentDevicePixelRatioForTest(1);
  });

  test("defaults to 96 DPI when no calibration is stored", () => {
    expect(cal.cssPxPerInch.value).toBe(96);
    expect(cal.isCalibrated.value).toBe(false);
  });

  test("physicalCardPx scales by current DPI", () => {
    expect(cal.physicalCardPx.value.w).toBe(CARD_WIDTH_IN * 96);
    expect(cal.physicalCardPx.value.h).toBe(CARD_HEIGHT_IN * 96);
    cal.setCalibration(110);
    expect(cal.physicalCardPx.value.w).toBe(275);
    expect(cal.physicalCardPx.value.h).toBe(385);
  });

  test("setCalibration persists across a fresh read", () => {
    cal.setCalibration(132);
    const raw = localStorage.getItem("decklistgen-display-calibration");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.cssPxPerInch).toBe(132);
    expect(typeof parsed.savedAt).toBe("string");
    expect(typeof parsed.savedDevicePixelRatio).toBe("number");
  });

  test("setCalibration clamps absurd inputs", () => {
    cal.setCalibration(0);
    expect(cal.cssPxPerInch.value).toBeGreaterThanOrEqual(40);
    cal.setCalibration(10_000);
    expect(cal.cssPxPerInch.value).toBeLessThanOrEqual(600);
  });

  test("isCalibrated flips true after first save", () => {
    expect(cal.isCalibrated.value).toBe(false);
    cal.setCalibration(110);
    expect(cal.isCalibrated.value).toBe(true);
  });

  test("reset returns to defaults and clears storage", () => {
    cal.setCalibration(110);
    cal.reset();
    expect(cal.cssPxPerInch.value).toBe(96);
    expect(cal.isCalibrated.value).toBe(false);
    expect(localStorage.getItem("decklistgen-display-calibration")).toBeNull();
  });

  test("zoomDrift is 0 immediately after calibration", () => {
    cal.setCalibration(110);
    expect(cal.zoomDrift.value).toBe(0);
  });

  test("zoomDrift grows when current DPR diverges from saved", () => {
    cal.setCalibration(110);
    __setCurrentDevicePixelRatioForTest(1.25);
    expect(cal.zoomDrift.value).toBeCloseTo(0.25, 5);
    __setCurrentDevicePixelRatioForTest(2);
    expect(cal.zoomDrift.value).toBeCloseTo(1, 5);
  });

  test("zoomDrift is 0 when uncalibrated regardless of DPR", () => {
    __setCurrentDevicePixelRatioForTest(2);
    expect(cal.isCalibrated.value).toBe(false);
    expect(cal.zoomDrift.value).toBe(0);
  });
});

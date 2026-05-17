import { describe, expect, it, beforeEach } from "bun:test";
import {
  getFontSelection,
  getFontSelectionOverrides,
  getFontSelectionDefaults,
  saveFontSelection,
  resetFontSelection,
  fontStack,
} from "./font-family-store.js";
import { DEFAULT_FONT_ID } from "../../../shared/constants/fonts.js";

describe("font-family-store", () => {
  beforeEach(() => {
    resetFontSelection();
  });

  it("returns defaults when no JSON file exists", () => {
    const sel = getFontSelection();
    expect(sel.title).toBe(DEFAULT_FONT_ID);
    expect(sel.body).toBe(DEFAULT_FONT_ID);
  });

  it("getFontSelectionDefaults returns DEFAULT_FONT_ID for both roles", () => {
    const d = getFontSelectionDefaults();
    expect(d.title).toBe(DEFAULT_FONT_ID);
    expect(d.body).toBe(DEFAULT_FONT_ID);
  });

  it("saveFontSelection persists and can be read back", () => {
    saveFontSelection({ title: "gill-sans", body: "gill-sans" });
    const sel = getFontSelection();
    expect(sel.title).toBe("gill-sans");
    expect(sel.body).toBe("gill-sans");
  });

  it("partial save only updates that role", () => {
    saveFontSelection({ title: "gill-sans" });
    const sel = getFontSelection();
    expect(sel.title).toBe("gill-sans");
    expect(sel.body).toBe(DEFAULT_FONT_ID);
  });

  it("resetFontSelection reverts to defaults", () => {
    saveFontSelection({ title: "gill-sans", body: "gill-sans" });
    resetFontSelection();
    const sel = getFontSelection();
    expect(sel.title).toBe(DEFAULT_FONT_ID);
    expect(sel.body).toBe(DEFAULT_FONT_ID);
  });

  it("unknown id falls back to default in getFontSelection", () => {
    saveFontSelection({ title: "does-not-exist", body: "also-fake" });
    const sel = getFontSelection();
    expect(sel.title).toBe(DEFAULT_FONT_ID);
    expect(sel.body).toBe(DEFAULT_FONT_ID);
  });

  it("getFontSelectionOverrides returns raw values (no validation)", () => {
    saveFontSelection({ title: "gill-sans" });
    const raw = getFontSelectionOverrides();
    expect(raw.title).toBe("gill-sans");
    expect(raw.body).toBeUndefined();
  });

  it("fontStack(role) returns a CSS stack starting with the chosen font's display name", () => {
    expect(fontStack("title")).toContain("'Inter'");
    saveFontSelection({ title: "gill-sans" });
    expect(fontStack("title")).toContain("'Gill Sans'");
    expect(fontStack("body")).toContain("'Inter'"); // body unchanged
  });

  it("save ignores non-string values", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    saveFontSelection({ title: 123 as any, body: "gill-sans" });
    const raw = getFontSelectionOverrides();
    expect(raw.title).toBeUndefined();
    expect(raw.body).toBe("gill-sans");
  });
});

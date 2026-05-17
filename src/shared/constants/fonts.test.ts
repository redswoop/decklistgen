import { describe, expect, it } from "bun:test";
import opentype from "opentype.js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { FONTS, DEFAULT_FONT_ID, resolveFont } from "./fonts.js";

// This integrity check is the firewall against the bug Phase A fixed.
// text.ts loads these same files via opentype.js for layout measurement,
// and type-icons.ts base64-embeds them for browser rendering. If a file path
// is wrong (typo, missing, unreadable, or non-parseable), the deployed cards
// drift between server-measured layout and browser-rendered glyphs.
const FONTS_DIR = join(import.meta.dir, "../../server/services/pokeproxy/fonts");

describe("font registry integrity", () => {
  it("DEFAULT_FONT_ID points at a real entry", () => {
    expect(FONTS[DEFAULT_FONT_ID]).toBeDefined();
  });

  it("resolveFont falls back to default for unknown id", () => {
    expect(resolveFont(undefined).id).toBe(DEFAULT_FONT_ID);
    expect(resolveFont("does-not-exist").id).toBe(DEFAULT_FONT_ID);
  });

  for (const def of Object.values(FONTS)) {
    describe(`${def.id} (${def.displayName})`, () => {
      it("weights are non-empty and ascending", () => {
        expect(def.weights.length).toBeGreaterThan(0);
        for (let i = 1; i < def.weights.length; i++) {
          expect(def.weights[i].weight).toBeGreaterThan(def.weights[i - 1].weight);
        }
      });

      it("titleWeight references an available weight", () => {
        const weights = def.weights.map((w) => w.weight);
        expect(weights).toContain(def.titleWeight);
      });

      it("bodyBoldWeight + bodyRegularWeight reference available weights", () => {
        const weights = def.weights.map((w) => w.weight);
        expect(weights).toContain(def.bodyBoldWeight);
        expect(weights).toContain(def.bodyRegularWeight);
      });

      for (const wf of def.weights) {
        it(`weight ${wf.weight}: file "${wf.file}" exists and parses with opentype.js`, () => {
          const path = join(FONTS_DIR, wf.file);
          expect(existsSync(path)).toBe(true);
          const buf = readFileSync(path);
          // opentype.parse accepts an ArrayBuffer
          const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
          expect(font).toBeDefined();
          expect(font.unitsPerEm).toBeGreaterThan(0);
        });
      }
    });
  }
});

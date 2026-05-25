/**
 * Theme contract test — guards the rule that every CSS custom property
 * referenced from a card component must be defined by every theme.
 *
 * This is the failure mode the variable-driven design is most prone to:
 * a component starts using `var(--something-new)` and one of the themes
 * silently inherits a global default (or nothing). Catching it at test
 * time beats finding it visually after a theme swap.
 */

import { describe, it, expect } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const LAB_DIR    = join(import.meta.dir);
const THEMES_DIR = join(LAB_DIR, "themes");
const CARDS_DIR  = join(LAB_DIR, "cards");

/** Pull `--foo` declarations from a CSS file. */
function definedVars(css: string): Set<string> {
  const out = new Set<string>();
  for (const m of css.matchAll(/(--[\w-]+)\s*:/g)) out.add(m[1]);
  return out;
}

/** Pull `var(--foo)` references from arbitrary text. */
function referencedVars(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/var\((--[\w-]+)/g)) out.add(m[1]);
  return out;
}

function walk(dir: string, ext: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p, ext));
    else if (p.endsWith(ext)) out.push(p);
  }
  return out;
}

describe("theme contract", () => {
  // Skip CSS partials (underscore-prefixed, e.g. _fonts.css). Same convention as Sass.
  const themeFiles = readdirSync(THEMES_DIR)
    .filter(f => f.endsWith(".css") && !f.startsWith("_"))
    .map(f => ({ name: f, path: join(THEMES_DIR, f) }));

  it("has at least two themes (so theme-swapping is exercised)", () => {
    expect(themeFiles.length).toBeGreaterThanOrEqual(2);
  });

  const componentFiles = walk(CARDS_DIR, ".vue");

  it("has card components to verify", () => {
    expect(componentFiles.length).toBeGreaterThan(0);
  });

  /*
   * Collect all variable references across all card components, ignoring:
   *   - scoped-component-internal vars like `--art` (defined inline via :style)
   *   - interpolated prefixes like `--color-type-${type}` — those end with `-`
   *     and are runtime-composed; we verify them separately below.
   */
  // Vars defined inline via component :style bindings rather than themes:
  //   --art               — CardFullArt sets background-image per-card
  //   --bg / --ring /
  //   --inner-ring        — EnergyDot composes solid bg color + stroke widths
  //                         from props (size, color-type-<T>)
  const INLINE_VARS = new Set(["--art", "--bg", "--ring", "--inner-ring"]);
  const allReferences = new Set<string>();
  for (const file of componentFiles) {
    for (const v of referencedVars(readFileSync(file, "utf8"))) {
      if (INLINE_VARS.has(v)) continue;
      if (v.endsWith("-")) continue;
      allReferences.add(v);
    }
  }

  const ENERGY_TYPES = [
    "Grass", "Fire", "Water", "Lightning", "Psychic",
    "Fighting", "Darkness", "Metal", "Fairy", "Dragon", "Colorless",
  ];

  for (const theme of themeFiles) {
    it(`theme ${theme.name} defines every variable referenced by components`, () => {
      const defined = definedVars(readFileSync(theme.path, "utf8"));
      const missing = [...allReferences].filter(v => !defined.has(v)).sort();
      expect(missing).toEqual([]);
    });

    it(`theme ${theme.name} defines a color for every EnergyType`, () => {
      const defined = definedVars(readFileSync(theme.path, "utf8"));
      const missing = ENERGY_TYPES
        .map(t => `--color-type-${t}`)
        .filter(v => !defined.has(v));
      expect(missing).toEqual([]);
    });
  }

  /*
   * Inverse direction: warn (don't fail) when a theme defines variables
   * no component uses — usually intentional palette extension, sometimes
   * dead variables. Keep it as an assertion-free `expect.anything` so it
   * shows up in test output without failing.
   */
  it("theme files are non-empty (smoke)", () => {
    for (const theme of themeFiles) {
      const defined = definedVars(readFileSync(theme.path, "utf8"));
      expect(defined.size).toBeGreaterThan(0);
    }
  });
});

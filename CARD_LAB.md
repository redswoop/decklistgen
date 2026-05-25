# Card Lab

A parallel **CSS / Vue card renderer** prototyped at `src/client/lab/`, evaluated as a replacement for the SVG + JSON-template pipeline in `src/server/services/pokeproxy/`.

The lab is an **isolated sandbox**: separate Vite multi-page entry, its own component tree, its own sample data. Nothing in the main app imports from `src/client/lab/`, and the lab imports nothing project-specific from the main app — delete the folder + the `lab` line in `vite.config.ts` to remove it cleanly.

## Why a CSS renderer

The SVG renderer's recurring pain is cross-platform text positioning — Mac and Windows font engines disagree on metrics, baselines, and `<text>` advance widths. The lab tests whether shifting to browser-native CSS layout solves it without losing the template-set / per-card-override roadmap (see [Template-sets rollout](../../.claude/projects/-home-armen-src-decklistgen/memory/project_template_sets_rollout.md) in memory).

**Validated payoff (one screenshot of the sample cards):** flex-based alignment renders identically across platforms, and "this aligns to that" relationships you previously expressed as anchor-offset math now express as flexbox containers. The bug-prone surface (computing baselines for energy-icon-next-to-attack-name, "Ability" pill next to ability text, HP digits next to type dot) disappears.

Direction is fullart-only — `pokemon-standard` is not a target for this renderer.

## Coordinate system & SVG parity

The lab's CSS `--card-w / --card-h` are **750 × 1050**, deliberately matching the SVG renderer's native canvas (`src/server/services/pokeproxy/constants.ts`). Every numeric value in the JSON templates (`data/templates/pokemon-fullart.json`) ports 1:1 — `anchorX: 514` becomes `left: 514px`, `fontSize: "$cardName.fullart"` (48) becomes `--size-name: 48px`, `"height": 55` on the suffix-logo image becomes `--size-suffix-logo: 55px`, `radius: 21` on the HP energy circle becomes `size={42}` on `<EnergyDot>`. When updating the lab, **read the source-of-truth values from these files**, not from screenshot eyeballing:

- Font sizes: `src/shared/constants/font-sizes.ts`
- Anchor coordinates and per-element pixel dimensions: `src/server/templates/builtin/default/pokemon-fullart.json`
- Energy-circle colors and glyph mapping: `ICON_MAP` in `src/server/services/pokeproxy/type-icons.ts`
- Inline `{X}` energy-token regex and rendering: `expandEnergyTokens()` in `src/server/services/pokeproxy/elements/text-element.ts`

If the SVG renderer changes any of these, the lab needs the matching change. There is currently no automated parity check — the [snapshot spec](./e2e/lab-snapshot.spec.ts) writes detail PNGs for visual review but does not assert anything.

## Where it lives

```
src/client/
  lab.html                    # second Vite entry (registered in vite.config.ts)
  lab.ts                      # imports _fonts.css + theme files, mounts Lab.vue
  lab/
    Lab.vue                   # preview page: theme picker, zoom slider, card grid
    types.ts                  # LabCard / LabAttack / LabAbility / EnergyType
    sample-cards.ts           # hand-authored sample cards (real card data)
    cards/
      CardFullArt.vue         # top-level fullart card composition
      parts/
        NameCluster.vue       # evolves-from + name + suffix logo
        HpCluster.vue         # HP label + value + type dot
        ContentPanel.vue      # glass-blur panel containing ability + attacks
        AttackBlock.vue       # cost icons + name + damage + effect
        FooterRow.vue         # weakness / resistance / retreat / illustrator
        EnergyDot.vue         # glassy type circle + EssentiarumTCG glyph
        EnergyTokenText.vue   # inline {X} energy-token rendering in effect text
    themes/
      _fonts.css              # @font-face declarations (CSS partial)
      default-fullart.css     # Authentic-TCG font/color theme
      noir-fullart.css        # Sanvito-Pro serif theme
    theme-contract.test.ts    # enforces "every var() ref is defined by every theme"
    sample-cards.test.ts      # validates sample-card shape

  public/
    logos/pokemon-ex.png      # copied from src/server/services/pokeproxy/fonts/
    logos/pokemon-v.png
    logos/pokemon-vstar.png
    fonts/*.otf, *.ttf        # all 6 fonts copied from the SVG renderer's fonts/
```

URL: **http://localhost:5173/lab.html** with `bun run dev` running.

## Architecture — the two-layer rule

The lab tests one specific structural commitment: **components own *structure*, themes own *decoration*.**

**Components hold:**
- DOM tree (semantic class names like `.name`, `.hp-value`, `.attack-name`)
- Layout primitives (flexbox containers, gap, align-items)
- Anchoring (absolute positioning of major regions inside the card)
- Conditional rendering (`v-if="evolvesFrom"`, `v-for="attack in attacks"`)

**Components do NOT hold:**
- Literal colors, font sizes, font families, font weights
- Shadow recipes, stroke widths, opacity values
- Panel insets, padding, radius, blur amounts

**Every visual value goes through a CSS custom property** defined in the theme file. Adding a literal color or font-size to a component CSS block is the only rule that matters here — it's what makes the theme-swap story work.

The `theme-contract.test.ts` test enforces the inverse: every `var(--foo)` a component references must be defined by every theme. If you add a new variable, add it to every theme file or the test fails. Skip CSS partials (filenames starting with `_`) — those are utility files like `_fonts.css`, not themes.

## Theme variables

### Font roles (mirroring `src/shared/constants/fonts.ts`)

| Variable | Default theme | Used by |
|---|---|---|
| `--font-title` + `--weight-title` | Gill Sans @ 900 (Condensed Bold) | Card name, attack name, ability name, ability-label pill |
| `--font-body` + `--weight-body` | Gill Sans @ 400 | Effect text, evolves-from |
| `--font-hp` + `--weight-hp` | Futura Heavy @ 900 | HP value, HP label, attack damage |
| `--font-infobar` + `--weight-infobar` | Frutiger @ 400 | Footer row (weakness/resistance/retreat/illustrator) |
| `--font-pokedex` | Sanvito Pro | Flavor text (not yet placed in any fullart card) |

Weights and families are split so a theme can swap one without the other: e.g. the noir theme uses Sanvito Pro for title/body but keeps Futura Heavy for HP.

### Anchored regions

The content panel **anchors bottom-only** — height is content-driven so a card with one attack hugs the lower portion of the art and a card with an ability + multiple attacks grows upward from the same baseline. Don't reintroduce a `top:` constraint on it.

| Variable | Purpose |
|---|---|
| `--card-w`, `--card-h` | Card geometry (750 × 1050) — kept in sync with the same constants in `Lab.vue` and the SVG renderer's `constants.ts` |
| `--panel-inset-side`, `--panel-inset-bottom` | Glass panel position (left/right, bottom-only) |
| `--panel-padding`, `--panel-padding-bottom`, `--panel-radius`, `--panel-blur`, `--panel-bg` | Glass panel decoration |
| `--footer-bottom` | Footer row position above the bottom edge |
| `--size-suffix-logo` | Name-tag logo height (55px in default; mirrors `"height": 55` on the suffix-image node in `pokemon-fullart.json`) |

### Energy palette

`--color-type-<EnergyType>` for each of the 11 energy types — values mirror `ICON_MAP` in `src/server/services/pokeproxy/type-icons.ts` so the lab's energy circles match the SVG renderer's. The `<EnergyDot>` component consumes them via interpolation: `background: var(--color-type-${type})`. The theme-contract test explicitly verifies every `EnergyType` constant has a matching theme variable.

### Energy icons inside text

Attack and ability effect text in TCGdex data uses inline `{X}` tokens (e.g. `"Put 2 {R} Energy attached to this Pokémon into your hand."`). The `<EnergyTokenText>` component splits these out and renders each token as a colored EssentiarumTCG glyph at `0.9em`, mirroring `expandEnergyTokens()` in `src/server/services/pokeproxy/elements/text-element.ts`. Dragon (`N`) substitutes a filled bullet because the font's `N` glyph spells "LEGEND" — same substitution the SVG renderer makes.

Verification card: `Volcanion` (`me01-025`) in `sample-cards.ts` ships with the real `{R}` token in its second attack effect — keep it in the sample list as the regression check.

### Suffix art: name-tag vs watermark

Two distinct categories, easy to conflate. See [the canonical reference](../../.claude/projects/-home-armen-src-decklistgen/memory/project_vmax_logo_missing.md) in memory.

- **Name-tag** logos (small, 55px tall, next to the card name) ship for ex / V / VSTAR. PNGs at `src/client/public/logos/`. Loaded via `LOGO_FILES` in `NameCluster.vue`.
- **Watermark** (large, ~280px, painted behind the artwork at 0.7 opacity) ships only for VSTAR. The asset (`pokemon-vstar-big.png`) lives in the SVG renderer's `fonts/` dir but is **not yet copied into the lab** — see "What graduation looks like" below.
- VMAX has **neither**. The lab falls back to the styled `.suffix-text` rendering in `NameCluster.vue`, which renders the literal "VMAX" string.

## Sample cards

Hand-authored to a lab-local `LabCard` shape, **not** the production `src/shared/types/card.ts`. Keep this decoupling until the lab graduates — the lab shouldn't depend on the SVG renderer's enrichment pipeline.

Card data is sourced from `cache/<id>.json` (real card data); art URLs hit `/api/pokeproxy/image/:id/clean` via the Vite proxy. Cards used here have confirmed `_clean.png` in the local cache — if you change a sample to a card whose clean art isn't cached, the art slot shows the dark fallback until the cleaner workflow runs.

## Suffix logos

ex / V / VSTAR render as actual PNG images (`/logos/pokemon-*.png`, copied from `src/server/services/pokeproxy/fonts/`). VMAX renders as styled text — **no VMAX asset exists anywhere in the repo or git history**, and `renderSuffixLogo()` in the SVG renderer returns empty for VMAX too. If a `pokemon-vmax.png` lands later, drop it at `src/client/public/logos/pokemon-vmax.png` and add `VMAX: "/logos/pokemon-vmax.png"` to `LOGO_FILES` in `NameCluster.vue`.

## Web fonts

`@font-face` declarations live in `themes/_fonts.css`, loaded once at app startup via `lab.ts`. Font files served from `src/client/public/fonts/` are the **same physical `.otf`/`.ttf` files** the SVG renderer uses — copied, not referenced through the server. If the SVG renderer adds a font, copy it across.

`font-display: swap` for live iteration (fallback shows immediately, real font swaps in). For print/screenshot determinism the right move is `font-display: block` plus `await document.fonts.ready` before render — not done in the lab yet, will matter when this graduates.

OS-installed fonts of the same family name win over the web-served file. If you ever need to force the bundled file (deterministic output across machines), give the `@font-face` a unique family name like `"Gill Sans Web"` and reference that.

## What graduation looks like

The lab is fullart-only. SVG-parity work done so far:

- ✅ 750×1050 coordinate system shared with the SVG renderer
- ✅ Font sizes match `src/shared/constants/font-sizes.ts` (header, attack, ability, footer, multiplier, label)
- ✅ Energy circles render the EssentiarumTCG glyph over a glassy gradient (matches `renderTypeIcon()`); Dragon falls back to inline SVG paths
- ✅ Energy palette colors mirror `ICON_MAP` (so `--color-type-Fire` etc. match what the SVG produces)
- ✅ Inline `{X}` energy tokens in effect text render as colored glyphs (via `<EnergyTokenText>`, mirrors `expandEnergyTokens()`)
- ✅ ex / V / VSTAR name-tag logos at 55px (mirrors `"height": 55` in the JSON template)
- ✅ Name-cluster uses nowrap; long names like "Mega Charizard X" no longer wrap to two lines

To replace the SVG renderer, the lab still needs:

- **Other card categories** — trainers, energy, special-energy, basic-energy. Each is its own component variant; the theme system carries unchanged.
- **VSTAR watermark** — the decorative full-card overlay behind VSTAR cards. The PNG (`pokemon-vstar-big.png`) lives in `src/server/services/pokeproxy/fonts/` already. Copy to `src/client/public/logos/` and wire through `CardFullArt.vue` (anchored at `left:-50px; top:-38px; height: 280px; opacity: 0.7; clip-path: card-clip`). See [name-tag-vs-watermark memory](../../.claude/projects/-home-armen-src-decklistgen/memory/project_vmax_logo_missing.md) for the canonical terminology and which suffixes have which.
- **Footer row inside the panel** — in the SVG renderer's JSON template, the weakness / resistance / retreat row + the rule text + the set+number footer all live *inside* the glassy content panel. The lab currently has them as a separate bottom-anchored row, outside the panel. Move them in to match.
- **Print determinism** — switch to `font-display: block`, await fonts, lock viewport to mm units, validate cross-machine output.
- **Per-card override storage** — the JSON template overrides (`data/card-text-overrides.json` etc.) become "theme name + per-card variable overrides." Phase 3/4 of the template-sets rollout shapes this.
- **Read fonts from `src/shared/constants/fonts.ts`** rather than hardcoded `@font-face` — so registry changes don't require lab edits.
- **Automated parity check** — currently `e2e/lab-snapshot.spec.ts` only writes screenshots; nothing fails the build if the lab drifts from SVG output. A diff test that renders the same card via both renderers and compares would catch regressions.

Nothing in the lab today blocks the main SVG renderer or the in-flight template-sets work; this is parallel exploration.

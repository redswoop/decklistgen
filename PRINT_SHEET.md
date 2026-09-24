# Print Sheet (`/print.html`)

The print sheet is a **separate Vite entry** (`src/client/print.html` → `print.ts` →
`src/client/print/PrintSheet.vue`), not part of the main SPA. You reach it only by a
hand-built URL, and its real output is `window.print()` — which **hangs headless
Chromium**. This doc exists so working on print never means reverse-engineering the
URL grammar or fighting the print dialog again.

## Wait on the state contract — never on timers

`PrintSheet` publishes its lifecycle on the `<html>` element as
`document.documentElement.dataset.printState` (`data-print-state` in the DOM). Drive it
by waiting for a terminal value:

| state     | meaning |
|-----------|---------|
| `loading` | mount in progress |
| `ready`   | sheet rendered, fonts settled, layout committed — **safe to screenshot** |
| `empty`   | loaded fine but nothing to print (filters excluded everything / empty deck) |
| `error`   | load failed; message shown in `.status-error` |

`ready`/`empty` are set two animation frames after `document.fonts.ready` — the same
commit point auto-print trusts — so the attribute only flips once the sheet is fully
laid out. **Always pass `auto=0`** when driving headless so `window.print()` never fires.

```js
// Playwright
await page.goto("/print.html?gallery=1&auto=0");
await page.waitForFunction(
  () => document.documentElement.dataset.printState === "ready",
  { timeout: 15000 },
);
await page.screenshot({ path: "print.png", fullPage: true });
```

## Three ways data reaches the page

1. **Deck** — `?deckId=<id>`. Fetches `/api/decks/<id>`, silently falling back to
   `/api/public/decks/<id>` on 401/403/404.
2. **Explicit cards** — `?cardId=<id>[,<id>…]`. Single-card or the 2-up jumbo pair.
3. **Gallery** — `?gallery=1`. Reads card IDs from `sessionStorage["gallery-print-ids"]`
   (set by `GalleryView.openPrint()`). For headless, seed it via `addInitScript`.

## URL parameters

(source of truth: `src/shared/utils/print-params.ts`)

| param          | values                                                      | default    | notes |
|----------------|-------------------------------------------------------------|------------|-------|
| `deckId`       | deck id                                                     | —          | path 1 |
| `cardId`       | comma-separated card ids                                    | —          | path 2 |
| `gallery`      | `1`                                                         | —          | path 3 |
| `size`         | `standard` \| `jumbo`                                       | `standard` | 63×87mm (measured real card) vs jumbo |
| `qty`          | `one-each`                                                  | repeat by deck count | one copy each |
| `paper`        | `letter` \| `super-b`                                       | `letter`   | 8.5×11 vs 13×19in |
| `orientation`  | `portrait` \| `landscape`                                   | `portrait` | |
| `exclude`      | csv of `pokemon,supporters,items,tools,stadiums,specialenergy` | —      | category filters |
| `noBasicEnergy`| `1`                                                         | off        | drop basic energy |
| `art`          | `proxy` \| `cleaned` \| `original` (csv, 1:1 with `cardId`) | `proxy`    | `cleaned`/`original` print as plain `<img>` |
| `crop`         | `0` to disable                                              | on         | crop marks in the 0.25in gutter + 0.5mm gap |
| `auto`         | `1` to auto-print on load                                   | off        | **keep off for headless** |

### Canonical examples

```
# deck, letter, proxies, crop marks (the common case)
/print.html?deckId=abc123&auto=0

# gallery batch (seed sessionStorage["gallery-print-ids"] first)
/print.html?gallery=1&auto=0

# single jumbo, original scan
/print.html?cardId=sv01-001&size=jumbo&art=original&auto=0

# 2-up jumbo pair, each its own version, landscape
/print.html?cardId=sv01-001,sv01-006&size=jumbo&orientation=landscape&art=original,proxy&auto=0

# deck, one copy each, exclude basic energy + items, on super-b
/print.html?deckId=abc123&qty=one-each&noBasicEnergy=1&exclude=items&paper=super-b&auto=0
```

## Shared layout utils (don't duplicate)

- `src/shared/utils/print-grid.ts` — `gridForPaper()`; paper/card dims, 0.25in origin.
  Standard card is **63×87mm** — a real Pokémon card measured with calipers (62.9×87.03).
  The nominal 2.5″×3.5″ poker size is 0.5mm wider and ~1.9mm taller than the real thing
  and jams perfect-fit sleeves. The renderer's 750×1050 canvas is a hair narrower in
  ratio, so the print scaler stretches ~1% on one axis to fill the cell exactly.
- `src/shared/utils/print-filter.ts` — `shouldPrintCard()`; the `exclude`/energy rules.
- `src/shared/utils/print-summary.ts` — `countPrintCards()`, `summarizePrint()`.
- `src/shared/utils/print-crop-marks.ts` — `cropMarkLayout()`; 0.5mm gap, corner marks.
- `src/shared/utils/print-cut-svg.ts` — `cutSvgForGrid()`; the Cricut cut SVG (see below).

## Page origin (Cricut)

The card grid **pins 0.25in from the top-left of the sheet**, not centered. That
matches a Cricut cut mat's 1/4″ no-cut zone: load the printed letter page onto
the mat and the first card starts where the machine can cut.

Leftover paper falls on the right and bottom. Partial last pages use the same
origin, so every sheet registers the same way.

Crop marks (on by default) sit in that 0.25in gutter and add a 0.5mm gap
between cards. Turn them off (`crop=0`) for flush 63mm × 87mm spacing.

**Print dialog:** Margins **None**, scale **100% / Actual size**. "Fit to
printable area" will shift the origin and miss the mat.

### Cut file

The print page (screen only, hidden when printing) has **Download Cricut cut
file**: an SVG built by `src/shared/utils/print-cut-svg.ts` from the *same*
cols/rows/card dims/gap the sheet on screen uses, so print and cut can't drift.

- **One compound `<path>`**, one rounded-rect subpath per cell (3 mm corners,
  like a real card). Design Space auto-arranges loose shapes on the mat but keeps
  a compound path together and cuts every subpath.
- **Canvas = grid bbox, not the page.** Design Space sizes an import by its
  path bbox and drops page space. Flush letter 3×3 is 189 × 261 mm. After import,
  check that size, then set the group's position to **X 6.35 mm, Y 6.35 mm** on
  the mat with the paper in the mat corner.
- It follows the sheet's crop-mark setting. For the Cricut, print with `crop=0`
  so the file is a flush grid; with marks on it bakes in the 0.5 mm gap instead.
- A partial last page uses the same file; the empty cells just cut blank paper.

**Calibration.** The bar's **Calibrate** opens four fields: where the blade
actually landed on a test cut (card 1 left/top, last column right, last row
bottom; mm from the paper edges). `solveCutCorrection()` turns those into a
per-axis scale plus the spot the cutter really drops the group's corner, and
`cutSvgForGrid()` pre-distorts the file so the next cut lands on the ink. When
the corner lands short of the origin the file gains a 1.5 mm **anchor square**
in the waste margin: it becomes the bbox corner Design Space positions, and the
cards ride the offset from it. Stored in `localStorage["cricut-cut-calibration"]`
(per printer+cutter, not per deck). Observed 2026-09-23: Design Space reported
the import at the right size, yet the blade landed 2.85 mm up/left and cut
every card 1.25 % small — hence a model rather than a diagnosis.

**Error budget.** The machine is the precise part (sub-¼ mm repeatable). What
eats accuracy is the printer's placement offset and skew (~0.5–1 mm on office
inkjets/lasers) and hand-placing the paper on the mat. Calibrate once: print a
flush sheet, measure the first card's top-left from the paper corner with
calipers, and correct in the print driver or by nudging the group in Design
Space. Rounded corners cover the rest of a small misalignment.

Cards render through the shared `CssCardRenderer.vue` (→ lab card components), same as
every other surface — print does not have its own renderer.

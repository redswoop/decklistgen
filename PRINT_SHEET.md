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
   `/api/public/decks/<id>` on 401/403/404. An optional `counts=` override (from the
   deck grid's print mode) sets per-card copies; unlisted cards print at deck count.
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
| `counts`       | `<cardId>:<n>[,…]` (base card id of the deck entry)         | —          | deck path only: per-card copy overrides from print mode; `0` drops the card, unlisted cards follow the deck (or `qty`). Encoded sparsely by `encodePrintCounts` in `print-plan.ts` |
| `art`          | `proxy` \| `cleaned` \| `original` (csv, 1:1 with `cardId`) | `proxy`    | `cleaned`/`original` print as plain `<img>` |
| `crop`         | `0` to disable                                              | on         | crop marks in the 0.25in gutter + 0.5mm gap |
| `auto`         | `1` to auto-print on load (Cricut mode: auto-download the PDF) | off     | **keep off for headless**. Nothing in the app sends it: every print entry point just opens the sheet, and the user presses **Print…** (`sheet-print`) or **Download print PDF** there |
| `mode`         | `cricut` — Print Then Cut without Design Space printing; pins portrait, no crop marks. `paper=super-b` puts two Letter regions on one 13 × 19 sheet | `sheet` | |
| `lift`         | Cricut mode: mm to lift the raster up its Letter sheet (0–30) | `8` on Letter, `0` on Super-B | |

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

# deck via print mode: 2 of one card, none of another, everything else at deck count
/print.html?deckId=abc123&counts=sv01-001:2,sv02-190:0&auto=0
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
- `src/shared/utils/print-cricut-archive.ts` — `planCricutArchive()`, `cricutManifest()`;
  the Design Space Print Then Cut ZIP (see below). `zip-store.ts` is the store-only ZIP writer.
- `src/shared/utils/print-cricut-layout.ts` — `CRICUT_LETTER_6UP` and the slot/raster/PDF
  geometry for Cricut mode (see below). `pdf-image-pages.ts` writes the lossless PDF.

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

### Bambu Suite Print Then Cut (H2 series cutting kit)

**Download page PNGs** on the same bar emits one PNG per page:
`src/client/print/rasterize-page.ts` serialises the live grid with
`html-to-image` at 300 dpi, clips every cell to a 3 mm rounded rect so gutters
and corners are transparent, and stamps a `pHYs` chunk
(`src/shared/utils/png-dpi.ts`) so Suite imports it at true size. Flush letter
3×3 is 2232 × 3083 px.

Workflow: import the PNG into Bambu Suite → process type **Print Then Cut** →
Make. Suite sends the 2D job to the paper printer (print at 100 %, no fit-to-
page) with its own four registration markers, the toolhead camera finds them
(placement tolerance ±10 mm X / ±5 mm Y), auto-cuts two reference lines to
measure the blade offset, then cuts along the alpha edge. Turn on Suite's bleed
(~0.15 mm) so a hair of misregistration never shows white. Print and cut are
the same file, so nothing can drift.

Open question (needs a Suite session): whether a 189 × 261 mm 9-up fits inside
Suite's marker frame on letter, or drops to 6-up.

**Error budget.** The machine is the precise part (sub-¼ mm repeatable). What
eats accuracy is the printer's placement offset and skew (~0.5–1 mm on office
inkjets/lasers) and hand-placing the paper on the mat. Calibrate once: print a
flush sheet, measure the first card's top-left from the paper corner with
calipers, and correct in the print driver or by nudging the group in Design
Space. Rounded corners cover the rest of a small misalignment.

### Cricut Design Space Print Then Cut

**Download Cricut PTC archive** (`data-testid="cricut-zip-download"`) is the
third route: let Design Space print *and* cut, instead of printing the sheet
here and importing the cut SVG. Design Space wants each element as its own
raster upload (one file per upload, no batch), sizes it from the PNG's DPI
metadata, traces the transparent edge for the cut contour, and auto-lays out
the sheets for the paper you pick *in Design Space*. Standard cards pack
**4 per Letter** (2×2 of 63×87 mm; the classic 6.75×9.25 in area and the beta
7.44×9.94 in area both stop there, rotation included) or **16 per A3** (4×4 in
the beta 10.64×15.44 in area, the largest Design Space offers; the ET-8550
feeds A3 natively). Jumbo is 1 per Letter, 4 per A3. Enable the larger sizes
under Settings → Application Experience → Beta.

So the ZIP holds one PNG per **unique** card (id + art mode + art URL), deduped
by `planCricutArchive()` with the copy count in the filename —
`4x-charizard-ex-sv03-125.png`, `1x-pikachu-sv08-057-original.png` — plus a
`README.txt` from `cricutManifest()` with the how-to, the physical size, and a
file list. Design Space names the layer after the file, so "4x-…" is the
duplicate count staring at you on the canvas. Each PNG is one `.print-cell`
rasterized by `rasterizeCell()` (same `html-to-image` path and 3 mm rounded
clip as the page PNG, one island instead of nine): 744 × 1028 px RGBA, `pHYs`
at 300 dpi. The archive is `cricut-ptc-<deck-slug|cards>-63x87mm-300dpi.zip`,
built in the browser by `buildZip()` (stored entries; PNGs are already deflated).

Workflow: Upload → Image → one PNG → Complex → Print Then Cut image; insert;
check the Edit bar reads 2.480 × 3.425 in (DS3 reads the dpi tag, but its
reference is 72 dpi and reports differ — if it lands wrong, lock the ratio and
type W = 2.480 once, or use the beta auto-resize); Duplicate to the count;
repeat; Make It. Leave Design Space's bleed on. Its own Print Then Cut
calibration applies here, not the sheet calibration above.

Trade-off vs the cut-SVG route: 4 per Letter instead of 9 (A3 closes that gap
at 16), and one upload per unique card, in exchange for zero placement/skew
error budget — Design Space's camera finds its own marks. Verified 2026-09-25:
its Print Then Cut calibration exposed a ~2.5 mm printer offset that had been
wrecking the hand-placed cuts; the first four cards came out perfect.

### Cricut mode: Print Then Cut without Design Space printing

`?mode=cricut` (Deck → Print → Layout → **Cricut Print Then Cut**, or
`buildDeckPrintUrl({ mode: "cricut" })`) is the fourth route and the one that
gets **6 per Letter**: we print the page, Design Space only cuts. It works
because Design Space's Letter Print Then Cut print is one deterministic 300 dpi
raster, measured 2026-09-25 from a real print
(`~/Sync/cricut-ptc/source/design-space-letter-6up-print.pdf`):

| Fact | Value |
|---|---|
| Raster | 2209 × 3080 px @ 300 dpi, placed `530.16 0 0 739.2 36 12.8 cm` (x 36 pt, top 40 pt) |
| Registration marks | 300 × 300 px blocks in the raster corners, ink `#121212` (TL has a corner gap + dot) |
| Uploaded sheet | lands at raster (0, 377), pixel-exact, no resampling |
| 6-up sheet | 2 × 3 landscape 1028 × 744 px cards, 47 px gap → 2103 × 2326 px = **17.81 × 19.69 cm** |
| Bleed | 8–10 px ring of extended edge pixels (corners filled with border colour) |
| Lower marks | end 4.5 mm from the paper edge — inside most printers' dead zone, hence the lift |

`print-cricut-layout.ts` holds that as `CRICUT_LETTER_6UP` (a profile, so A3 can
follow once measured; Super-B below reuses it twice). The sheet lays the same geometry out live for preview
(`.cricut-page`, slots absolutely positioned in inches, cards turned a quarter
turn counter-clockwise inside a landscape `.print-cell`), and **Download print
PDF** (`cricut-pdf-download`) rasterizes each unique card once
(`rasterizeCellCanvas`), composes each page in `cricut-export.ts` (white, Design
Space's mark pixels from `public/cricut/ds-marks-letter.png`, cards at their
slots with a 10 px bleed ring), zlib-deflates the RGB, and writes a lossless
PDF (`pdf-image-pages.ts`) that places the raster exactly where Design Space
does, lifted `lift=` mm (default 8) so the lower marks clear the printer.
`auto=1` downloads the PDF instead of calling `window.print()`.

**Download Design Space cut fixture** (`cricut-fixture-download`) is the
one-time setup: a 2103 × 2326 px PNG with six opaque rounded islands. Upload it
as a Print Then Cut image, set its width to 17.81 cm, never move it. Because
every printed page has the same six outlines at the same places, the cut job is
identical for every sheet: Make It → print to PDF and discard → paper flush in
the mat corner → cut. A partial last page just cuts empty rectangles.

Print the PDF at 100 % on Letter, fit-to-page off. Orientation/crop are
pinned in this mode even if the URL says otherwise. Cards per sheet on the deck
bar and in the dialog follow the mode and the paper.

#### Super-B: two Letter regions on one 13 × 19 sheet

`mode=cricut&paper=super-b` (`CRICUT_SUPER_B_12UP`) is not a Design Space size.
It prints the Letter raster **twice on one 13 × 19 in page**, 12 cards, and the
sheet is then cut in half across its length; each 13 × 9.5 in half goes through
the Cricut as if it were a Letter page, against the same Letter cut fixture.

| Fact | Value |
|---|---|
| Page | 936 × 1368 pt portrait (the printer feeds the 13 in edge) |
| Top region | Letter sheet turned a quarter turn clockwise, its top-left on the page's **top-right** corner: `0 -530.16 739.2 0 156.8 1332 cm` |
| Bottom region | the same a half turn round, Letter top-left on the page's **bottom-left** corner: `0 530.16 -739.2 0 779.2 36 cm` |
| Seen landscape | that is top-left and bottom-right |
| Cut line | 9.5 in (684 pt), **printed**: black, 1.5 pt, dashed 12/6 pt, edge to edge (`cricutCutLine()`); each Letter sheet ends 1 in short of it |
| Lift | none: the marks sit 12.7 mm from the feed edges and 14.1 mm from the sides |

Each region's Letter top-left is a factory corner of the big sheet, so the half
loads into the mat corner with its registration marks exactly where Design
Space looks for them; the hand-cut edge ends up on the far side, 1 in past where
the Letter page would end. A region with no cards is left off the page (no
marks), so up to six cards only ink the top half. The cut line is always
printed and the preview shows it at the same weight. Geometry per region is a `CricutRegion` (turn + bounding
box); `cricutRegionTransform()` places it in the preview and
`cricutPdfMatrix()` in the PDF, which carries one raster per region
(`buildPdf()` in `pdf-image-pages.ts`).

Verified: Playwright decodes page 1 at 300 dpi and checks mark pixels, the
corner gap, card islands and white gutters at the measured coordinates
(`e2e/cricut-print.spec.ts`).

Cards render through the shared `CssCardRenderer.vue` (→ lab card components), same as
every other surface — print does not have its own renderer.

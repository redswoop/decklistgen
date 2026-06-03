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

(source of truth: `PrintSheet.vue:74-111`)

| param          | values                                                      | default    | notes |
|----------------|-------------------------------------------------------------|------------|-------|
| `deckId`       | deck id                                                     | —          | path 1 |
| `cardId`       | comma-separated card ids                                    | —          | path 2 |
| `gallery`      | `1`                                                         | —          | path 3 |
| `size`         | `standard` \| `jumbo`                                       | `standard` | 2.5×3.5in vs jumbo |
| `qty`          | `one-each`                                                  | repeat by deck count | one copy each |
| `paper`        | `letter` \| `super-b`                                       | `letter`   | 8.5×11 vs 13×19in |
| `orientation`  | `portrait` \| `landscape`                                   | `portrait` | |
| `exclude`      | csv of `pokemon,supporters,items,tools,stadiums,specialenergy` | —      | category filters |
| `noBasicEnergy`| `1`                                                         | off        | drop basic energy |
| `art`          | `proxy` \| `cleaned` \| `original` (csv, 1:1 with `cardId`) | `proxy`    | `cleaned`/`original` print as plain `<img>` |
| `crop`         | `0` to disable                                              | on         | crop marks + 0.5mm gap |
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

- `src/shared/utils/print-grid.ts` — `gridForPaper()`; paper/card dims, 0.25in margin.
- `src/shared/utils/print-filter.ts` — `shouldPrintCard()`; the `exclude`/energy rules.
- `src/shared/utils/print-summary.ts` — `countPrintCards()`, `summarizePrint()`.
- `src/shared/utils/print-crop-marks.ts` — `cropMarkLayout()`; 0.5mm gap, corner marks.

Cards render through the shared `CssCardRenderer.vue` (→ lab card components), same as
every other surface — print does not have its own renderer.

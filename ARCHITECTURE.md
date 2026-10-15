# Architecture — where things live

A feature → file map so orientation is cheap: to change a feature, start at its
**controller**, then its **composables** (logic/state) and **leaf components**
(UI). The pattern throughout is **thin controller composes small pieces**: a
`.vue` component owns top-level state + layout and delegates logic to
`use*` composables and pure `shared/utils` / `lib` modules.

See also: [CLAUDE.md](./CLAUDE.md) (commands, conventions), [CARD_LAB.md](./CARD_LAB.md)
(the CSS card renderer), [PRINT_SHEET.md](./PRINT_SHEET.md) (the print URL grammar),
[SETUP_SIM.md](./SETUP_SIM.md) (the setup simulator).

## Conventions

- **Pure module** (`src/shared/utils/`, `src/client/lib/`) — `export function`, no
  Vue, co-located `*.test.ts`. This is where testable logic goes.
- **Composable** (`src/client/composables/use<Feature>.ts`) — `use<Feature>`,
  returns a flat object of refs + actions. State + IO wiring. Pure logic worth
  testing is extracted to a module and unit-tested; api-wired parts are covered
  by e2e.
- **Leaf component** (`src/client/components/<cluster>/`) — `<script setup>`,
  `defineProps`/`defineEmits`, presentational. Feature clusters get a subfolder.
- **Styles**: component-scoped where possible. When a cluster splits into child
  components that share class names, the styles move to a global stylesheet
  imported in `main.ts`, **namespaced under the root class** (e.g.
  `styles/admin.css` under `.admin-overlay`) so generic names don't leak.

## Root

- **`App.vue`** — root controller: view-tab + deck-sub-view routing, global
  dialogs, auth gate. Composes:
  - `useLayoutControl` — sidebar widths/collapse (persisted) + drag-resize +
    mobile slide-overs.
  - `useCardPreview` — the lightbox preview state machine + `?card=` deep-link
    sync. Keeps `handlePreview` / `handleDeckPreview` / `handleCardsPreview` as
    the mediators children wire to.
  - `useBrowseGenerate` — browse multi-select + bulk generate.
  - `useUndoRedo` — global Cmd/Ctrl-Z shortcuts.

## Card lightbox

- **`CardLightbox.vue`** — controller. Emit contract to App: `close` /
  `cardChange` / `deckUpdated`. Composes:
  - `useCardNavigation` — search-set prev/next (stable `activeCard`).
  - `useCardVariants` — same-name variant set + selected `currentCard`.
  - `useVariantDeckControl` — add/remove/swap into the working deck. (It also
    has a saved-deck path via `shared/utils/variant-deck-ops.ts`, but nothing
    sets `savedDeckId` on the lightbox any more, so that path only runs in
    unit tests.)
  - `useCardImageResolution` — bg/main/zoom images + generation state
    (pure version→URL in `lib/card-image-resolution.ts`).
  - `useVariantBulkGeneration` — "generate all variants".
  - `useCardVersion` — Original/Cleaned/Proxy selection.
  - Leaves (`components/lightbox/`): `VersionThumb`, `CardStatsPanel`,
    `CardZoom`, `LightboxDevTools`.

## Working deck + save

- **`useDecklist`** — the working deck singleton (cards + identity + undo),
  persisted to localStorage. Identity is `currentDeckId` / `currentDeckName`
  plus `lastSavedSnapshot`, the card list as of the last full save; `isDirty`
  compares against it (an unsaved deck is dirty iff it has cards). Undo entries
  carry the identity too, so undoing a clear/import/close restores the saved-deck
  handle instead of leaving an orphan. `clear()` empties the cards and keeps the
  deck loaded (an edit); `closeDeck()` drops the deck and its history (a
  switch); `renameDeck()` never touches the dirty baseline; `markSaved()` is
  only called after a full save landed.
- **`useDeckSave`** — the one writer to the server: `saveCurrent()` (PUT in
  place) and `saveAsNew(name)` (POST + adopt), both toast on failure and return
  a boolean. Serves the context-bar Save, save-before-print (awaited, print mode
  only opens on success), the name dialog, Duplicate, and "new" imports.
- **`DeckContextBar.vue`** — the Save button is always labelled Save; disabled
  with a reason (sign in / no changes / add cards). Rename is inline.
- **`WorkingDeckView.vue`** — toolbar: Beautify always edits the working deck
  (dirty, undoable); Import replace/merge only edit the working deck (the normal
  Save commits them); Duplicate opens the name dialog as "Duplicate Deck" with
  "(Copy)" suggested and switches to the new deck; Clear is an edit; Delete
  closes.
- **`DeckGalleryView.vue`** — deck cards + ⋯ menu (Rename / Duplicate via the
  server copy route / Delete); dirty guard before opening another deck, New
  Deck, or admin act-as.

## Card grid

- **`CardGrid.vue`** — controller; keeps the virtualizer + container-sizing +
  external-vs-API branching inline by design. Composes:
  - `useSortGroup` — sort/group/fold state + persistence + fold strategy
    (pure `sortCards`/`groupCards`/`chunkCards` in
    `shared/utils/card-sort-group.ts`).
  - `useCardSearch` — debounced deck-context add-card search.

## Function tags

What a card *does* (draw, gust, energy accel, …), inferred from printed effect
text — no hand-curated card list. Supporters and Items only so far; Tools,
Stadiums, abilities and attacks are untagged rather than half-right.

- **`shared/utils/effect-tags.ts`** — the vocabulary (`EFFECT_FACETS` /
  `EFFECT_TAGS`: id, label, facet, description) and the pure tagger
  (`tagEffectText`, `tagCard`). Tags are flat and multi-valued; the `x:y` prefix
  is the family (`search` matches `search:pokemon`, see `hasEffectTag`).
  Per-name corrections live in `shared/constants/effect-tag-overrides.ts`.
- **Stamped at load**: `card-store.ts` `normalizeCard` sets `Card.effectTags`
  (absent when empty). Tags are derived, never stored, so renaming one is a code
  change with no migration. Reprints TCGdex ships without effect text borrow a
  same-name printing's tags (`shareTrainerTags`).
- **Filter**: `CardFilters.effectTags` — all listed tags must match
  (`filter-cards.ts`). One field serves the Browse "Does" chips in
  `InlineFilterBar.vue` (`?tags=`), `GET /api/cards?effectTags=`, and the MCP
  `search_cards` tool; MCP `get_filter_options` also returns the registry.
- **Group**: `GroupBy "function"` in `card-sort-group.ts` buckets by facet. A
  card sits under every facet it has a tag in, so `CardGrid` dedupes the
  lightbox nav list.
- **Audit surface**: `lightbox/CardStatsPanel.vue` shows a card's tags.
- **Changing a rule**: edit the regex, then add or fix the card's row in
  `effect-tags.test.ts` using its real printed text. Saved decks hold `Card`
  snapshots, so cards added before a tagging change keep their old tags (or
  none) until re-added.

## Custom sets

Locally defined cards (`custom-sets/<folder>/set.json` + `art/*.png`), see CLAUDE.md.

- **`server/services/custom-sets.ts`** — discovery + registration into the shared
  set maps (`registerCustomSets`, run when `card-store` loads), card lookup
  (`getCustomSetCards`, `getCustomCardRaw`), artwork path (`getCustomArtPath`).
- **Hooks**: `card-store.loadSet` (reads from disk for custom codes),
  `card-detail.getCardDetail` (raw from the set file), `pokeproxy/cache.ts`
  `resolveArtFile` (custom PNG stands in for `cache/<id>.png` and `_clean.png`;
  used by `card-generation.getArtStatus`, the `/api/pokeproxy/image` route and
  the gallery), `set-codes.getEra` (`custom-` prefix → `custom` era).
- **`server/routes/custom-sets.ts`** — `GET /api/custom-sets` (list) and
  `GET /api/custom-sets/art/:id/<file>` (the artwork; a custom card's
  `imageBase` points here).
- **`cli/custom-set-art.ts`** — composes `art/src/<localId>.svg` + the card's
  `art` block (banner / caption / meter) into the 750×1050 PNG with resvg.

## Gallery

- **`GalleryView.vue`** — controller. Composes `useGalleryFilter`
  (pure `lib/gallery-filter.ts`), `useGallerySelection`, `useGalleryPreview`,
  `useGalleryGeneration` (single-card clean/prompt), `useGalleryBulkGeneration`.
  Leaves in `components/gallery/`; force-confirm uses the shared
  `components/ConfirmDialog.vue`.

## Print

- **`PrintSheet.vue`** (`/print.html` entry) — controller: keeps the
  `data-print-state` readiness machine + layout. `usePrintLoader` loads the
  deck/cards/gallery entries.
- **`JumboPrintDialog.vue`** — pair-picker. `usePrintCardSearch` (debounced),
  leaves `components/print/{JumboCardSlot,PrintCardSearch}.vue`.
- **`shared/utils/print-params.ts`** — the URL grammar as a tested unit:
  `parsePrintParams` (PrintSheet consumes) + `buildJumboPrintUrl`
  (JumboPrintDialog produces) + `buildDeckPrintUrl` (PrintDialog produces).
  See PRINT_SHEET.md.
- **Deck print mode** — `WorkingDeckView.vue` flips `CardGrid` to
  `context="print"`: the grid becomes a print plan (tile −/+ edit print counts
  capped by the deck, group headers carry an all/none/mixed checkbox, grouping
  is pinned to print category). `usePrintPlan` holds the per-deck plan +
  last-printed record in localStorage; every rule is pure in
  `shared/utils/print-plan.ts` (categories, clamping, group state, "since last
  print" delta, the sparse `counts=` encoding). `PrintDialog.vue` is just the
  layout step (paper / orientation / art / crop, remembered via
  `lib/print-options.ts`) and opens the sheet.
- **Sheet downloads** — the `.cut-file-bar` on the sheet: Cricut cut SVG
  (`shared/utils/print-cut-svg.ts` + calibration), Bambu page PNGs
  (`print/rasterize-page.ts` `rasterizePage`, `shared/utils/png-dpi.ts`), and
  the Cricut Design Space Print Then Cut ZIP (`rasterizeCell` per unique card,
  planned + named by `shared/utils/print-cricut-archive.ts`, packed by
  `shared/utils/zip-store.ts`, a store-only ZIP writer).
- **Cricut mode** (`?mode=cricut`, PrintDialog → Layout) — the sheet reproduces
  Design Space's own Letter Print Then Cut raster (6 landscape cards, its
  registration marks, its bleed) and downloads a lossless PDF, so Design Space
  only cuts. With `paper=super-b` the page carries that raster twice, a half
  turn apart, for a 13 × 19 sheet that is cut in half. Geometry profile: `shared/utils/print-cricut-layout.ts`;
  compositing: `print/cricut-export.ts`; PDF bytes: `shared/utils/pdf-image-pages.ts`;
  mark pixels: `client/public/cricut/ds-marks-letter.png`. See PRINT_SHEET.md.

## Test hand

- **`TestHandPanel.vue`** — controller. `useTestHandStats` (Monte-Carlo, wraps
  `shared/utils/hand-sim.ts`), `useHandTester` (deck/hand state), `useCardZoom`
  (reusable click-to-zoom). Leaves `components/testhand/{PlayOrderSelector,
  HandDisplay,HandStats}.vue` + the reusable `components/lightbox/CardZoomOverlay.vue`.

## Admin

- **`AdminPanel.vue`** — thin tab shell. Section components in
  `components/admin/{Users,InviteCodes,MagicLinks}AdminSection.vue`, each
  self-contained. **`SyncDecksPanel.vue`** is the sync wizard controller over
  `useSyncDecks` with `components/sync/` phase leaves. Pure helpers:
  `lib/{date-format,magic-link-status,invite-code-form}.ts`. Styles:
  `styles/admin.css` + `styles/sync.css`.

## MCP server

- **`src/server/mcp/server.ts`** — `createMcpServer(ctx)`; `ctx.user` is the
  caller (null = anonymous). **`context.ts`** — `requireUser`,
  `requireAuthorizedUser`, `effectiveUserId` (admin `actAsUserId` ≙ REST
  `X-Act-As-User`). Tools by area in `tools/`: `sets`, `cards`, `decklist`,
  `public-decks`, `proxy` (anonymous OK); `users`, `decks`, `sim`, `art` (need
  identity). Transports: `routes/mcp.ts` (HTTP, bearer or `/t/<token>` path),
  `cli/mcp.ts` (stdio, `DECKLISTGEN_API_TOKEN`).
- Services the tools share with REST: `deck-beautify.ts` (pure beautify, the
  name + mechanicsHash grouping), `deck-sim.ts` (server-side hand / setup sims +
  plain-language `interpretation`), `card-generation.ts` (art status + queueing,
  also used by `routes/proxy.ts`), `api-token-store.ts`.
- Client: `ApiTokensDialog.vue` (user menu → API Tokens) mints / lists / revokes
  tokens via `api.{list,create,revoke}ApiToken`.
- Full catalogue and conventions: MCP.md.

## Shared building blocks

- Reusable components: `ConfirmDialog.vue` (used across deck + gallery flows),
  `lightbox/CardZoomOverlay.vue`, `CssCardRenderer.vue` (production card render —
  see CARD_LAB.md).
- The card renderer, data queries (`useCards`, `useVariants`, `useCardDetail`,
  `useDecks`, `useDecklist`), and print geometry (`print-grid`,
  `print-crop-marks`, `print-filter`) are stable shared infrastructure.

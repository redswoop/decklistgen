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
  - `useVariantDeckControl` — add/remove/swap into working or saved deck
    (pure array math in `shared/utils/variant-deck-ops.ts`).
  - `useCardImageResolution` — bg/main/zoom images + generation state
    (pure version→URL in `lib/card-image-resolution.ts`).
  - `useVariantBulkGeneration` — "generate all variants".
  - `useCardVersion` — Original/Cleaned/Proxy selection.
  - Leaves (`components/lightbox/`): `VersionThumb`, `CardStatsPanel`,
    `CardZoom`, `LightboxDevTools`.

## Card grid

- **`CardGrid.vue`** — controller; keeps the virtualizer + container-sizing +
  external-vs-API branching inline by design. Composes:
  - `useSortGroup` — sort/group/fold state + persistence + fold strategy
    (pure `sortCards`/`groupCards`/`chunkCards` in
    `shared/utils/card-sort-group.ts`).
  - `useCardSearch` — debounced deck-context add-card search.

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
  (JumboPrintDialog produces). See PRINT_SHEET.md.

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

## Shared building blocks

- Reusable components: `ConfirmDialog.vue` (used across deck + gallery flows),
  `lightbox/CardZoomOverlay.vue`, `CssCardRenderer.vue` (production card render —
  see CARD_LAB.md).
- The card renderer, data queries (`useCards`, `useVariants`, `useCardDetail`,
  `useDecks`, `useDecklist`), and print geometry (`print-grid`,
  `print-crop-marks`, `print-filter`) are stable shared infrastructure.

# DecklistGen

Pokemon TCG proxy tool: browse cards, build decklists, generate cleaned artwork, print proxies.

**See also:**
- [ARCHITECTURE.md](./ARCHITECTURE.md) — where things live: the feature → controller + composables + leaf-components map. Start here to orient before changing a feature.
- [CARD_STYLE.md](./CARD_STYLE.md) — visual conventions for rendered cards (aesthetic priorities, template alignment rules).
- [CARD_LAB.md](./CARD_LAB.md) — CSS/Vue card renderer at `src/client/lab/`. It now powers every card surface (lightbox, grid thumbs, gallery, print sheet); the lab page is the live sandbox for theme/component work.
- [PRINT_SHEET.md](./PRINT_SHEET.md) — the `/print.html` print sheet: URL grammar for all three data paths (deck / cardId / gallery), and the `data-print-state` readiness contract to wait on instead of timers or `window.print()` when driving it headless.
- [SETUP_SIM.md](./SETUP_SIM.md) — the Setup Simulator (Deck → "Setup Sim"): Monte-Carlo "turns to set up" engine, the card-effect inference pipeline (rules from printed text), chain resolution, and the calibration/confidence model.

## Tech Stack

- **Runtime**: Bun
- **Server**: Hono (port 3001)
- **Client**: Vue 3 + Vite + TanStack Vue Query (port 5173 dev)
- **Data**: TCGdex API, cached as JSON in `cache/`
- **Image gen**: ComfyUI + Flux Klein 9B (optional, for artwork cleaning)
- **Card render**: client-side Vue components in `src/client/lab/cards/`, themed via CSS variables in `src/client/lab/themes/`. Mounted via `CssCardRenderer.vue`.

## Commands

```bash
bun run dev              # Start server + client (concurrently)
bun run dev:server       # Server only (--watch)
bun run dev:client       # Client only (Vite)
bun test                 # Run all tests
bun test --filter <pat>  # Run matching tests
```

- Vite config is at `src/client/vite.config.ts` — run `vite build` from `src/client/`, not the project root

## Testing

**Every new feature or bug fix must include tests.** No exceptions.

- Test framework: `bun:test` (import from `"bun:test"`)
- Test files live next to the code they test: `foo.ts` → `foo.test.ts`
- Run `bun test` before considering any work done
- Tests must pass before committing

### Verify UI changes in a browser

For any change that affects what users see — new components, new tabs/views, layout rebuilds, anything where "did it render correctly?" matters more than "does it compile?" — drive a headless browser walk before declaring done. Type-checks and unit tests pass on wrong-but-renderable bugs. Past example: a Gallery font-sizes redesign passed all 718 unit tests and `vue-tsc` cleanly, but a headless walk caught that the template-grouping computed was routing every fullart card into `pokemon-standard` because the synthesized object passed to `suggestTemplate()` was missing the fields its inner `isFullArt()` reads.

Playwright is configured (`playwright.config.ts` at repo root, e2e specs in `e2e/`, `@playwright/test` in devDeps). On a fresh machine you'll need to install the browser binary (`bunx playwright install chromium`) and the system libraries Chromium depends on — the exact packages vary by OS.

Dev servers run on `:3001` (Hono) and `:5173` (Vite); tests hit the Vite URL. Don't spawn them from tests — connect to the ones the user already has running. A 401 from `/api/auth/me` during anonymous walks is expected noise.

### File-backed stores

If you add a new file-backed store, redirect its path via an env-var override so tests don't wipe the user's real `data/<name>.json`:

```ts
const STORE_PATH = process.env.<NAME>_STORE_PATH
  ?? join(import.meta.dir, "../../../data/<name>.json");
```

Then add `process.env.<NAME>_STORE_PATH ??= join(dir, "<name>.json");` to `tests/setup-test-env.ts` (wired via `bunfig.toml`'s `[test] preload`).

## Code Style

- TypeScript strict mode, ESNext modules
- Path alias: `@shared/*` → `./src/shared/*`
- No default exports — use named exports
- Keep functions small and focused
- No unnecessary abstractions or over-engineering

## Project Structure

```
src/
  server/          # Hono API server
    routes/        # Route handlers
    services/      # Business logic (card-store, tcgdex, comfyui, pokeproxy)
  client/          # Vue 3 SPA
  shared/          # Shared types and constants
cli/               # CLI tools
cache/             # Runtime cache (not committed)
data/              # Persistent data files (prompts.json etc.)
```

## Deployment

- **Docker image**: `skywarp75/decklistgen`
- **CI/CD**: GitHub Actions builds and pushes the Docker image on push to `main`
- **Watchtower**: Runs on the NAS, polls every 5 min, auto-pulls new images
- **Deploy workflow**: Just push to `main` — CI builds the image, Watchtower picks it up
- **Environment variables**: `PORT` (default 3001), `COMFYUI_URL`
- **Volumes**: `/app/cache`, `/app/data`

## UX Rules

- **No disappearing buttons.** Never use `v-if` to hide a button based on state. Instead, always render it as `disabled` with a `title` tooltip explaining why the action is unavailable. Users should always see what actions exist, even when they can't use them yet.

## Gallery

The Gallery (Vue view `GalleryView.vue`, backed by `GET /gallery/cards`) previews every rendered card across the deck + a reference card set. Use it to spot regressions in the CSS renderer, audit which cards still need clean art, and inspect the cleaning pipeline (Source / Cleaned tabs). When adding new visual cases worth scrutinizing, extend `TEST_CARDS` in `src/server/routes/gallery.ts`.

## Card Renderer

The card renderer is **client-side CSS/Vue** — `CssCardRenderer.vue` adapts a production `Card` + optional `CardDetail` into the lab's `LabCard` shape via `src/client/lib/card-to-lab.ts`, then mounts one of the three card variants in `src/client/lab/cards/` (`CardFullArt`, `CardTrainer`, `CardBasicEnergy`). Theme variables live in `src/client/lab/themes/`. See `CARD_LAB.md` for the full architecture (components-hold-structure / themes-hold-decoration, font roles, energy palette).

### Print sheet

Deck-print and gallery-print both open `/print.html?…` in a new tab — a dedicated Vite entry (`src/client/print/PrintSheet.vue`) that fetches the deck (or reads card IDs from `sessionStorage`), waits for `document.fonts.ready`, and lays out a 2.5″×3.5″ grid sized to the requested paper. Triggered from `PrintDialog.vue`; on the Gallery side, `openPrint()` stashes IDs in `sessionStorage["gallery-print-ids"]`.

## Client Architecture

- All client UI must use Vue 3 components. No server-rendered HTML pages with embedded JS for client-facing features.

### Lightbox Preview Modes

- `handlePreview` (source=`'grid'`) — for browse/search views, arrow nav cycles grid results
- `handleDeckPreview` (source=`'deck'`) — for deck views, arrow nav cycles deck cards, shows deck name
- Components in deck context (WorkingDeckView, DeckView, DeckContextPanel) must wire `@preview-card` to `handleDeckPreview`, not `handlePreview`

### CardGrid Slots

- `#toolbar` slot — inject action buttons into the grid header row (used by WorkingDeckView and DeckView)

## Auth Model

- Anonymous users can browse cards, build local WIP decks, import/export, and beautify. Server-side features (save, generate, print) require sign-in.
- Auth middleware: `sessionMiddleware` (resolves user on every request), `requireAuth` (401 if no user), `requireAuthorized` (403 if not authorized/admin)
- Public API routes: `/api/cards`, `/api/sets`, `/api/decklist`, `/api/public/decks`, `/api/pokeproxy/status`, `/api/pokeproxy/image`
- Protected API routes: `/api/decks` (requireAuth on all), `/api/pokeproxy/generate` (requireAuthorized), `/api/pokeproxy/queue` (requireAuth)
- Client auth state: `useAuth()` composable (singleton refs). `useAuthDialog()` for triggering sign-in dialog from any component.
- TanStack Query: gate queries on `enabled: isLoggedIn` to avoid 401s for anonymous users. Queries auto-fire when user signs in.
- Vite build runs from `src/client/`: `cd src/client && npx vite build`

## TODO

- [ ] Add e2e tests (Playwright) for deck card management flows:
  - Deck search adds card to deck (not preview) when clicking a search result
  - Variant picker allocation reflects artCard overrides; applying clears stale artCards
  - Sort/group controls reorder cards and persist across reload
  - Card consolidation: same card with/without artCard merges correctly
- [ ] **Restore skipped e2e specs.** The following describe blocks are `test.describe.skip` after the CSS-renderer migration changed the UI structure they exercised. Each needs to be re-walked against the current app and rewritten — not just selector renames. Tackle one at a time when next touching the relevant component:
  - `e2e/save-deck.spec.ts` "Deck Save Flow" — save/clear moved from DecklistPanel to DeckContextBar (`.dcb-save-btn`)
  - `e2e/deck-sidebar-selection.spec.ts` "Deck Sidebar Selection" + "DeckView Toolbar Actions" — nav tab renamed Decks→Deck, sidebar selection model rebuilt
  - `e2e/mobile-browse-load.spec.ts` "Mobile Browse Initial Load" — mobile filter slide-over selectors drifted
  - `e2e/mobile-layout.spec.ts` "Mobile Layout" + "Desktop Layout" — mobile nav buttons and slide-over structure changed
- [ ] **Bug:** No deck-legality validation exists. Radiant Pokemon are limited to 1 total per deck (combined across all Radiants), but the UI lets you add unlimited copies with no warning. Same gap likely affects ACE SPEC (1/deck), Prism Star (1 of each), and the standard 4-copy limit. Detection hook: `rarity === "Radiant Rare"` in `src/server/services/card-store.ts` `normalizeCard()`; surface warning in `WorkingDeckView.vue`.

## Git

- Commit messages: short imperative summary (e.g., "Add pokemon search endpoint")
- Don't commit `cache/`, `dist/`, `node_modules/`, or `.env` files

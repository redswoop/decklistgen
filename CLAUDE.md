# DecklistGen

Pokemon TCG proxy tool: browse cards, build decklists, generate cleaned artwork, print proxies.

**See also:**
- [CARD_STYLE.md](./CARD_STYLE.md) — visual conventions for rendered cards (aesthetic priorities, template alignment rules).
- [CARD_LAB.md](./CARD_LAB.md) — CSS/Vue card renderer prototype at `src/client/lab/`, evaluated as a replacement for the SVG renderer. Isolated sandbox, fullart-only, components-hold-structure + themes-hold-decoration architecture.

## Tech Stack

- **Runtime**: Bun
- **Server**: Hono (port 3001)
- **Client**: Vue 3 + Vite + TanStack Vue Query (port 5173 dev)
- **Data**: TCGdex API, cached as JSON in `cache/`
- **Image gen**: ComfyUI + Flux Klein 9B (optional, for artwork cleaning)
- **SVG proxy**: TypeScript renderer in `src/server/services/pokeproxy/`

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

Beware destructive side-effects when walking the Gallery: clicking Save/Reset/Delete buttons hits endpoints that can wipe real `data/*.json` files (see the Gallery section below).

### File-backed stores

Any file-backed store under `src/server/services/pokeproxy/*-store.ts` must use an env-var path override so tests can be redirected to a temp directory:

```ts
const STORE_PATH = process.env.<NAME>_STORE_PATH
  ?? join(import.meta.dir, "../../../../data/<name>.json");
```

Add a matching `process.env.<NAME>_STORE_PATH ??= join(dir, "<name>.json");` line to `tests/setup-test-env.ts` (wired via `bunfig.toml`'s `[test] preload`).

**Why:** stores typically export a `resetX()` function that `unlinkSync`s the file at `STORE_PATH`, and test files call it in `beforeEach`. Without the env-var indirection, `bun test` wipes the user's real `data/<name>.json` on every run. This bit `font-family-store.test.ts` and `font-style.test.ts` before the env-var pattern was introduced.

Currently wired: `FONT_FAMILY_STORE_PATH`, `FONT_SIZE_STORE_PATH`. `energy-palette-store.ts` exports `resetPalettes()` (called in `beforeEach`) but does **not** use the env-var pattern yet — it should.

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

The `/gallery/` endpoint (`src/server/routes/gallery.ts`) is the place to preview and evaluate all visual samples — rendered cards, energy glyphs, etc. When adding new visual elements or previews, add them to the gallery page, not the main client app.

**Destructive endpoints:** the Gallery exposes Save and Reset controls for several override stores. `DELETE /gallery/font-sizes`, `DELETE /gallery/palettes`, and `DELETE /gallery/font-family` each call the corresponding `resetX()` store function, which `unlinkSync`s the underlying `data/*.json` file outright. There is no soft-reset. Don't click Reset (or trigger DELETE from a script) without backing the file up first — snapshot, or `git checkout HEAD -- data/<file>.json` after.

## Template Conventions

JSON card templates in `data/templates/` should follow these conventions:

- **Opacity tiers (3 levels only)**:
  - `1.0` — primary content (names, HP, ability/attack effect text, attack damage)
  - `0.7` — secondary (subtitles, evolves-from, decorative watermarks)
  - `0.5` — tertiary (rule text, footer, faded labels)
- **Left-edge anchorX**: name-cluster at `45`, evolves-from at `47` (matches fullart/vstar/trainer)
- **HP energy radius**: `21` across all templates
- **Content-block padding**: `paddingTop: 15`, `padding L/R: 15`, `paddingBottom: 37`, `rx: 25`, `filter: "glass-blur"` for cards with glassy content panels.
- **Suffix logo** (the `ex` / `V` / `VSTAR` mark next to the name) lives as a sibling image inside the `name-cluster` box, bound to `_nameSuffix`.

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
- Public API routes: `/api/cards`, `/api/sets`, `/api/decklist`, `/api/public/decks`, `/api/pokeproxy/status`, `/api/pokeproxy/svg`, `/api/pokeproxy/image`
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
- [ ] **Bug:** No deck-legality validation exists. Radiant Pokemon are limited to 1 total per deck (combined across all Radiants), but the UI lets you add unlimited copies with no warning. Same gap likely affects ACE SPEC (1/deck), Prism Star (1 of each), and the standard 4-copy limit. Detection hook: `rarity === "Radiant Rare"` in `src/server/services/card-store.ts` `normalizeCard()`; surface warning in `WorkingDeckView.vue`.

## Git

- Commit messages: short imperative summary (e.g., "Add pokemon search endpoint")
- Don't commit `cache/`, `dist/`, `node_modules/`, or `.env` files

# DecklistGen

Pokemon TCG proxy tool: browse cards, build decklists, generate cleaned artwork, print proxies.

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

## Testing

**Every new feature or bug fix must include tests.** No exceptions.

- Test framework: `bun:test` (import from `"bun:test"`)
- Test files live next to the code they test: `foo.ts` → `foo.test.ts`
- Run `bun test` before considering any work done
- Tests must pass before committing

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

## Client Architecture

- All client UI must use Vue 3 components. No server-rendered HTML pages with embedded JS for client-facing features.

## Git

- Commit messages: short imperative summary (e.g., "Add pokemon search endpoint")
- Don't commit `cache/`, `dist/`, `node_modules/`, or `.env` files

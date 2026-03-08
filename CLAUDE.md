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
- **Architecture**: Always build for `linux/amd64`
- **Build command**:
  ```bash
  docker buildx build --platform linux/amd64 -t skywarp75/decklistgen:latest --push .
  ```
- The Dockerfile clones from GitHub at build time — push your changes before building
- **Environment variables**: `PORT` (default 3001), `COMFYUI_URL`
- **Volumes**: `/app/cache`, `/app/data`

## Git

- Commit messages: short imperative summary (e.g., "Add pokemon search endpoint")
- Don't commit `cache/`, `dist/`, `node_modules/`, or `.env` files

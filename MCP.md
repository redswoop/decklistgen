# MCP server

DecklistGen exposes its card database, deck storage, artwork pipeline and
simulators over the [Model Context Protocol](https://modelcontextprotocol.io) so
a Claude (Claude Code, claude.ai connector, Claude Desktop) can browse cards and
manage a player's decks by talking.

Code: `src/server/mcp/` — `server.ts` builds the `McpServer`, `context.ts` holds
the per-request identity, `tools/*.ts` register tools by area. Transports:
`src/server/routes/mcp.ts` (Streamable HTTP, stateless, one server per request)
and `cli/mcp.ts` (stdio, against this checkout's `data/` + `cache/`).

## Connecting

| Client | How |
| --- | --- |
| Anonymous browsing | `POST https://<host>/api/mcp` — the card / set / import tools work without identity. |
| Claude Code | `claude mcp add --transport http decklistgen https://<host>/api/mcp --header "Authorization: Bearer dg_…"` |
| URL-only clients (claude.ai custom connector) | `https://<host>/api/mcp/t/dg_…` — the token rides in the path; the access log redacts it. |
| Stdio (Claude Desktop, local) | `bun cli/mcp.ts` with `DECKLISTGEN_API_TOKEN=dg_…` in the env. |

Tokens are minted in the web UI: **user menu → API Tokens**. The plaintext is
shown once; only a SHA-256 lands in the `api_tokens` table. A token acts *as the
user who minted it* with that user's current role flags, so revoking authorized /
admin status downgrades their tokens too. Revoke from the same dialog. REST API:
`GET/POST /api/auth/tokens`, `DELETE /api/auth/tokens/:id`.

`Authorization: Bearer dg_…` is also honoured by every REST route (it is
resolved in `sessionMiddleware` when there is no session cookie), so scripts can
use the same token against `/api/decks` etc.

## Identity model

- `whoami` — who the connection is. Call it first before touching decks.
- Deck / sim / art tools take an optional `actAsUserId`. Admins may name another
  user (mirrors the REST `X-Act-As-User` header); everyone else is scoped to
  their own decks. Find a player with `list_users` (admin) or
  `find_decks { query, allUsers: true }` (admin, returns the owner per row).
- Anonymous → deck tools return an `isError` result explaining how to connect.
- `generate_deck_art` / `cancel_generation_job` additionally require an
  *authorized* account (same gate as the REST generate route).

## Tool catalogue

**Browse (anonymous OK)** — `list_sets`, `load_set`, `load_era`, `search_cards`,
`get_card`, `get_card_variants`, `get_variant_groups`, `get_filter_options`,
`parse_ptcgo_text`, `import_limitless`, `import_limitless_player`,
`format_decklist`, `list_public_decks`, `get_public_deck`, `get_card_image_url`,
`get_card_image`, `proxy_status`.

**Identity** — `whoami`, `list_users` (admin).

**Decks** — `list_decks`, `find_decks`, `get_deck` (compact rows by default,
`full=true` for raw `Card`s; always includes a category summary and legality
issues), `create_deck` (from `cards` ids and/or PTCGO `decklistText`),
`rename_deck`, `delete_deck`, `copy_deck`, `set_deck_visibility`,
`export_deck_text`, `check_deck_legality`.

**Cards in a deck** — `edit_deck` (an ordered list of `add` / `remove` / `set`
/ `swap` / `art` ops, one save; any failing op aborts the batch unsaved — prefer
it over a run of single calls), plus the single-op forms `add_cards`,
`remove_cards` (omit `count` = all copies), `set_card_count` (0 removes),
`swap_card_printing` (move all or `count` copies onto another printing; refuses
a *different* card unless `allowDifferentCard=true`; "same card" = same name +
`mechanicsHash`, or any basic energy of the same type), `set_card_art` (the
`artCard` override), `replace_deck_cards` (wholesale), `beautify_deck` (`best`
/ `diverse`, same grouping as the Beautify dialog — name + mechanicsHash, never
name alone; `dryRun` previews; `seed` makes `diverse` reproducible).

Every mutation takes `verbose` (default `false`): the response is `{ id, name,
updatedAt, summary, legality, changed }` where `changed` lists only the rows
whose count or art override moved (`previousCount` → `count`; removed rows show
`count: 0`). `verbose: true` returns the whole deck as `get_deck` would.
Mutations on one deck are serialized behind a per-deck lock, so parallel calls
can't drop each other's edits.

Cards are addressed by id (`sv06.5-036`, what `search_cards` returns) or
`"SETCODE LOCALID"` (`"PAF 54"`). Deck entries are keyed by printing
(`setCode:localId`); the store consolidates duplicate stacks on every save.

**Simulators** — `simulate_opening_hands` (hand-sim Monte Carlo: mulligan rate,
Basic + Supporter odds, no-Supporter-or-Item rate, per-card / per-category
"seen by turn N") and `simulate_setup` (the Setup Simulator over every
evolution line, or `lineIds`; cumulative set-up odds per turn with 95 % CIs,
average setup turn, never-set-up rate, structural impossibility). Both return
the raw stats **and** an `interpretation: string[]` of plain-language takeaways
derived server-side (`src/server/services/deck-sim.ts`), so a remote Claude can
discuss the result without re-deriving the model. See SETUP_SIM.md for what the
model does and doesn't cover — the CIs are sampling error only.

**Images** — `get_card_image_url` returns links: `url` is the original scan
(TCGdex CDN, or this server's `/api/custom-sets/art/…` for a custom card) and
`images` holds this server's `/api/pokeproxy/image/<id>/<type>` link for every
render in its cache (`source` / `clean` / `composite` / `fullart`; `?w=<px>`
for a thumbnail). `get_card_image` returns the picture itself as an MCP image
block (`width` default 512, `0` = full size; JPEG unless `format: "png"`) — the only way a remote
Claude can see a render that exists solely in this server's cache, custom-set
art in particular. Server-relative paths are made absolute from the context's
`baseUrl`: the HTTP transport derives it from `PUBLIC_URL`, else
`X-Forwarded-Proto` / `X-Forwarded-Host`, else the request URL; stdio reads
`DECKLISTGEN_URL` and otherwise leaves paths relative.

**Artwork** — `deck_art_status` (which printings have clean / full-art renders),
`generate_deck_art` (queue ComfyUI jobs for missing or all printings; per-card
outcome `queued | already_exists | skipped | no_prompt`), `get_generation_queue`,
`cancel_generation_job`. Generation plumbing is shared with the REST route via
`src/server/services/card-generation.ts`.

## Conventions for new tools

- Register in a `tools/<area>.ts` with `registerXTools(server, ctx)`; take the
  `McpContext` and resolve identity with `effectiveUserId` / `requireUser` /
  `requireAuthorizedUser` from `context.ts`. Return `asJson(...)` and
  `fail(...)` — never throw.
- Mutations go through the same store functions the REST routes use
  (`deck-store.ts`), and `logAction(..., "mcp", …)`.
- Keep responses compact: full `Card` objects are large; default to the compact
  row shape and offer `full` only where a caller needs it.
- Add the tool name to the "advertises every registered tool" test in
  `server.test.ts` and an end-to-end case in `tools/decks.test.ts` (in-memory
  transport, real SQLite, real cached cards).

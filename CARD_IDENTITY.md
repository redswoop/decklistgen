# Card Identity

How the app decides two cards are "the same" — and why that has three answers.
Read this before touching variants, folding, beautify, `artCard`, or anything
that looks up generated art. Audited 2026-09-30 against the full local index
(8,246 cards) and the prod deck table.

---

## 1. The three identities

| Identity | Key today | Meaning | Scryfall analogue |
| --- | --- | --- | --- |
| **Printing** | `card.id` (`setId-localId`) | One physical piece of cardboard | `id` |
| **Card** | `name` + `mechanicsHash` | Same gameplay object; printings are interchangeable at the table | `oracle_id` |
| **Artwork** | Card + `illustrator` + `artTier(rarity)` | Same picture, possibly on several printings | `illustration_id` |

Nothing below is wrong because a surface picked one of these. Things go wrong
when a surface uses one identity to look up something stored under another.
§5 records the decision: **Artwork is the unit the app cares about**; Printing
is how humans refer to it; Card is what Artwork belongs to.

### `mechanicsHash` is looser than it sounds

`src/server/services/mechanics-hash.ts`. Per category:

- **Pokémon** — MD5 of sorted **attack names + ability names**. Not HP, not
  type, not cost, not damage, not effect text, not weakness, not retreat.
- **Trainer** — `trainerType` only. Every Supporter hashes the same.
- **Energy** — literal `"basic"` or `"special"`.

It is only meaningful *paired with `name`* (273 hashes are shared across
different Pokémon — Bulbasaur/Tarountula/Lileep all hash to "Tackle").
Every caller pairs it with name today; keep it that way.

The leniency is deliberate (errata, TCGdex missing weakness on promos), but it
over-reaches. Census of the 1,399 Pokémon name+hash groups with >1 printing:

| Printings in the same "card" differ by | Groups | Example |
| --- | --- | --- |
| weakness (data noise — tolerated on purpose) | 103 | most MEP promos |
| attack effect text | 35 | Eldegoss SWSH 21 / SWSHP 046 |
| ability text | 23 | Rillaboom, Frosmoth, Gengar |
| attack cost / damage | 20 | Chikorita MEG 008 (20) vs MEP 046 (30) |
| HP | 15 | Sobble SWSH 54 (60) vs MEP 054 (70) |
| **energy type** | 5 | Qwilfish SWSH 51 Water vs CRI 052 Darkness |
| retreat | 4 | Toxel, Croagunk, Goomy |

So ~70 "variant" groups are actually different cards. Beautify and the variant
picker will happily swap between them.

Name is also normalised before comparison: `normalizeCard` strips a trailing
parenthetical into `subtitle` (`card-store.ts:62-65`), so every "Professor's
Research (…)" is one card. Fine for Trainers; watch it if a Pokémon name ever
carries a parenthetical.

---

## 2. Who uses which key (as of 2026-09-30)

| Surface | Lookup key | File |
| --- | --- | --- |
| Working deck entry match | `setCode + localId` of `card` | `useDecklist.ts:110` |
| Consolidation on save | `setCode:localId` | `consolidate-deck.ts:14` |
| Grid counts, print plan, membership | `card.id` | `WorkingDeckView.vue:56`, `print-plan.ts`, `customized-cards.ts:112` |
| `getVariants(id)` (default) | name + hash; basic energy by **type across names** | `card-store.ts:225-246` |
| `getVariants(id, byName)` | name only | same |
| Lightbox variant picker | **by name**, then `deduplicateByArt` (hash+illustrator+tier) | `useCardVariants.ts` |
| Beautify (server + client) | groups deck **by name**, fetches variants **by mechanics** using the *first* entry's id | `decks.ts:194-222`, `BeautifyDialog.vue:90-111` |
| Grid fold "same art" | name + hash + tier — **ignores illustrator** | `fold-cards.ts:73-79` |
| Grid fold "same card" | name + hash | `fold-cards.ts:89-92` |
| Legality 4-copy rule | name | `deck-legality.ts:81-98` |
| Setup sim rules | name, **first printing wins** | `setup-sim.ts:137-147` |
| Import fallback (unknown set/number) | name, **first card in index order wins** | `card-store.ts:207-215` |
| Generated art (`_clean.png`, status, prompts) | `card.id`, no sharing of any kind | `pokeproxy/cache.ts:15-17` |
| Print sheet | `artCard ?? card` — the **whole** card (text, filter, art) | `usePrintLoader.ts:92` |
| Deck tiles / lightbox from deck | `card` with `artCard.imageBase` pasted on | `WorkingDeckView.vue:41-44` |

Two "same art" definitions exist (`deduplicateByArt` keys on illustrator, the
`SAME_ART` fold doesn't), so the browse grid can stack two printings the
lightbox shows separately, and vice versa.

---

## 3. `artCard` is dead

`DeckCard.artCard` was an image override that could point at *any* card
(commit `56ccc5e`: different mechanics was the point). Today:

- **No producer.** `setCardArtCard` has no callers outside tests; the lightbox
  code that set it was removed in `442c7cd`. Zero of 412 entries across all 16
  prod decks carry one.
- **Four disagreeing consumers.** Legality/sim/export/public view ignore it;
  the deck grid uses only its image (and only in Original mode); the print
  sheet uses it as the whole card. An `artCard` with different mechanics would
  print the wrong attacks.

Only raw `PUT /api/decks`, admin sync, and old saved decks can still carry
one. Plan: delete the field and its readers, or constrain it to the same Art
identity and make every reader agree. Don't leave it half-alive.

---

## 4. Original vs generated: where the modes disagree

Generated art is stored per **printing** with no fallback across the Art
group. Consequences:

- `deduplicateByArt` hides same-art reprints from the lightbox picker and from
  "Generate N", so the hidden printings never get cleaned. A deck holding the
  hidden printing (Ultra Ball SVI 196 vs MEG 131, same art, same mechanics)
  prints the original scan under Proxy while its twin prints cleaned.
- Beautify can move a deck onto a printing that has no cleaned art.
- Two independent version toggles: lightbox `selectedVersion` (localStorage
  `decklistgen-card-version`: original/cleaned/proxy) and grid `imageMode`
  (URL `?mode=`: original/proxy). The lightbox variants grid, deck print and
  CardThumb follow `imageMode`; Jumbo follows `selectedVersion`.
- Fallback chains differ per surface:

| Surface | Proxy mode, no cleaned art |
| --- | --- |
| CardThumb / deck tile | original scan |
| Lightbox main | Generate button (no image) |
| Print sheet | CSS frame drawn **over the full original scan** (frame-in-frame) |
| Gallery thumb | "No clean art" placeholder, never the scan |
| Inspector | blank art area |
| Jumbo preview | original scan |

- Print resolves `/image/:id/clean` with **no cache-bust** (`usePrintLoader.ts:46`);
  the route sets `max-age=86400`, so regenerate-then-print can print stale art.
  Every other surface passes `v=` (the inspector passes `t=`).

---

## 5. Target model: the art registry

Decided 2026-09-30 (Armen): **minimize the number of art artifacts we think
about.** Two Limitless entries that are the same picture on different
printings are one thing; the player's exact ids were never information we
wanted. That rules out "fall back across the group at lookup time" (the plan
this section used to describe) in favour of collapsing on the way *in*.

### Objects

- **Card** — gameplay identity. `source: "tcgdex" | "local"`. For official
  cards it points at a TCGdex id for text; for custom cards the registry
  entry *is* the `CardDetail` (attacks, abilities, HP, type, weakness). A
  `legal` flag; custom cards are never Standard-legal.
- **Artwork** — the unit decks, print counts, generated images and cleaned
  art are keyed by. Has an **app-minted, permanent id** (opaque; never
  recomputed), a Card pointer, an image source (TCGdex scan of a printing, or a
  local file — generated or uploaded), and a list of Printings. Custom cards
  have zero official Printings.
- **Printing** — a TCGdex id. A *reference* to an Artwork for humans and
  importers. Carries set symbol, number, regulation mark — display data.

### Rules

1. **Ids are minted, not derived.** `data/art-registry.json` (committed,
   shipped in the image, carried by sync) maps `artId → { cardKey, printings,
   canonicalPrinting, source }`. The illustrator+tier heuristic only *proposes*
   groupings for printings the registry hasn't seen; once written, an entry is
   a fact. Fixing the heuristic later touches only unregistered cards. A wrong
   merge is a hand edit that splits the entry.
2. **Collapse on import.** Paste, Limitless and MCP imports resolve each
   printing to its Artwork; same-Artwork entries sum. Saved decks store art
   ids. One-time migration rewrites existing decks and `cache/` filenames.
3. **Key ≠ display.** The registry key is permanent (first registered
   printing, pinned). What the proxy *shows* in its footer — set symbol,
   number, regulation mark — is resolved at render time from a preference,
   default *newest printing*, and the renderer already draws those from
   fields. Changing the preference re-keys nothing.
4. **Generated art is one per Artwork**, because there is only ever one
   Artwork per picture in any deck. No sharing machinery needed; the "Generate
   N" gap and the SVI-vs-MEG Ultra Ball mismatch cannot arise.
5. **Beautify = pick a different Artwork of the same Card.** Grouped by
   `cardKey`, never by name; never rewrites entries it didn't change.
6. **`artCard` is deleted.** Its one legitimate use (different art, same
   text) is simply "a different Artwork of the same Card".
7. **`mechanicsHash` stops being an identity** and becomes a field that
   decides which Card an Artwork belongs to — correctable by hand in the
   registry. Tightening it (cost/damage/HP/type) is then low-risk and should
   ship with the §1 census as a test fixture so the ~70 splits are reviewed.

### Order of work

1. Registry schema + minting script over the current index; the census as a
   fixture. No consumer changes yet.
2. Route every row of §2 through `artId` / `cardKey`; migrate saved decks and
   `cache/` names.
3. Delete `artCard`; unify the two version toggles and the fallback chains.
4. Tighten the hash.
5. Custom cards: `source: "local"` Card + Artwork with a local image; the lab
   page as the editor.

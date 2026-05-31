# Setup Simulator

The Setup Simulator answers one question for a Pokémon TCG deck: **how many turns until a given line's key attacker is set up?** ("Set up" = the line's final-stage Pokémon is in play — energy and attacking are out of scope.) It's a Monte-Carlo "goldfish": it shuffles and plays the deck out against no opponent, many times, with a greedy bot that tries to assemble each line as fast as the rules allow, and reports the per-turn probability that each line is online.

It lives under **Deck → "Setup Sim"** (a sub-view next to Build and Test Hand) and reports *every* evolution line in the deck at once, grouped by kind, with 95% confidence intervals.

---

## 1. What it models (and what it doesn't)

**Modeled**
- Shuffle, 7-card opening hand, mulligan (reshuffle if no Basic), **6 prizes** set aside.
- Going first / second (first turn draws 0 / 1 respectively).
- Evolution timing: a Pokémon can't evolve the turn it entered play, and nothing evolves on your first turn.
- **Rare Candy** (Basic → Stage 2, skipping Stage 1), respecting the same timing.
- Trainer engine inferred from card text: draw, search a Pokémon/Trainer/Supporter/whole-line, bench Basics, with discard costs, energy-type / rule-box restrictions, and coin flips.
- **Pokémon abilities** (any stage) that draw or search — the bot sets up secondary "engine lines" (e.g. Bibarel, Genesect, Lunatone+Solrock) and uses their abilities each turn.

**Not modeled** (deliberate scope)
- Energy attachment / attack costs — "set up" means *in play*, not *ready to attack*.
- The opponent — no Boss's Orders, no disruption, no prizes taken, no Knock Outs (so post-KO abilities like Fezandipiti's never fire, which is correct for setup turns).
- Abilities other than draw/search (healing, damage, energy accel, switching), Stadiums, Tools.
- A *perfect* pilot: the bot plays a sensible greedy line, not a solved one. It also only sets up engine pieces it draws or benches via Poffin/Nest — it won't dedicate hard-searches to a secondary engine.

CIs reported in the UI are **sampling error only** (Monte-Carlo noise). They do not quantify model error from these approximations.

---

## 2. Architecture & data flow

```
Deck (working deck or saved deck)
  └─ flatten to one SimCard per physical card
       └─ GET /api/cards/evolutions?ids=…        (server)
            → per card: { stage, chain[], effect?, abilities[]? }
       └─ attach to SimCards (chain + effect + abilities)
  └─ buildEvolutionLines(simCards)               → the deck's lines
  └─ for each line: runSetupSim(...)             → SetupSimResult (+ CIs)
  └─ SetupSimPanel renders all lines, grouped by kind
```

| Concern | File |
| --- | --- |
| Draw/shuffle/hypergeometric primitives | `src/shared/utils/hand-sim.ts` |
| Evolution-line construction | `src/shared/utils/evolution-lines.ts` |
| Card-effect rule inference (Trainers + abilities) | `src/shared/utils/setup-rules.ts` |
| Name-based fallback for cards lacking effect text | `src/shared/utils/setup-cards.ts` |
| The Monte-Carlo engine + greedy bot | `src/shared/utils/setup-sim.ts` |
| Confidence-interval statistics | `src/shared/utils/sim-stats.ts` |
| Server-side chain resolution | `src/server/services/evolution-chain.ts` |
| Batch endpoint | `src/server/routes/cards.ts` (`GET /cards/evolutions`) |
| Client fetch | `src/client/lib/client.ts` (`getCardEvolutions`) |
| Reactive wiring | `src/client/composables/useSetupSim.ts` |
| UI | `src/client/components/SetupSimPanel.vue` |

Everything in `src/shared/utils/` is **pure** (no Vue, no network) and unit-tested next to the source.

---

## 3. Evolution-chain resolution (server)

`SimCard.chain` is the ordered list of names from the base Basic up to the card, e.g. `["Charmander","Charmeleon","Charizard ex"]`. The endpoint resolves it from TCGdex `evolveFrom` data, which is per-card and sometimes missing, so resolution falls back through several sources (`src/server/services/evolution-chain.ts`):

1. **The card's own cached `evolveFrom`** (`cache/<id>.json`).
2. **Any other cached printing of the same species** — a lazy, memoized name→evolveFrom index built once from every `cache/*.json` (~160ms, ~9k files). Sets that ship without the data (e.g. the Mega-Evolution set `me02.5`, where Totodile/Croconaw/Mega Feraligatr ex are all `null`) are recovered from older printings (`sv05` Croconaw → Totodile).
3. **A cached TCGdex name lookup** (`fetchCardEvolveFromByName`) as a last resort.

**Mega Pokémon** ("Mega X ex") carry no `evolveFrom`. Per the card text ("the mega evolved form of X"), `megaBaseSpecies()` strips the `Mega` prefix, the `ex` suffix, **and the X/Y variant tag** (`Mega Charizard X ex` → `Charizard`) and resolves the chain from the base species.

`resolveChainNames()` walks `evolveFrom` links with a depth cap (4) and a cycle guard; the lookup is injectable so it's unit-testable offline.

---

## 4. Evolution-line construction (`evolution-lines.ts`)

`buildEvolutionLines(cards)` groups the deck's Pokémon by name and assembles `EvolutionLine`s from the resolved chains:

- `basicName`, `stage1Name` (only set if that Stage 1 is in the deck), `finalName`, plus copy counts and the representative `finalCard`.
- `finalStage` ∈ `Basic | Stage1 | Stage2`; `normStage()` maps TCGdex stages, treating VMAX/VSTAR as Stage-1-like and blanks as Basic.
- `requiresRareCandy` — a Stage 2 whose Stage 1 isn't in the deck (only Candy bridges it).
- `warnings` — `missing-evolve-from` / `broken-chain` / `no-basic`.

Lines are sorted by "kind" (Stage 2 ex > Stage 2 > Basic ex/V > Stage 1 > Basic). The report shows **all** lines; each is simulated independently as a target.

---

## 5. Card-effect inference — the rules pipeline

This is the heart of the project: the bot does **not** use a hardcoded card list. It reads each card's printed effect/ability text and infers a *capability* (`src/shared/utils/setup-rules.ts`). New cards and future sets work automatically; misclassifications are fixed by improving the parser, not by editing a name table.

### 5.1 Capabilities

```ts
type Capability =
  | { type: "draw"; amount: number; shuffleHand: boolean }
  | { type: "draw-to"; size: number }                                  // "draw until you have N"
  | { type: "bench-basics"; count; maxHp?; energyType? }               // search Basics → Bench (Poffin, Nest Ball)
  | { type: "search-pokemon"; restrict; count; maxHp?; energyType? }   // → hand (Ultra Ball, Poké Pad, Hilda…)
  | { type: "search-line" }                                            // basic+stage1+stage2 → hand (Dawn)
  | { type: "search-trainer" }                                         // → hand (Petrel, Arven)
  | { type: "search-supporter" }                                       // → hand (Pokégear)
  | { type: "rare-candy" };
// restrict ∈ "any" | "basic" | "evolution" | "non-rule-box"
```

A **Trainer** classifies to `SetupRule { cap, source: "item"|"supporter", discard, coinFlip }`; a **Pokémon ability** to `AbilityRule { cap, trigger: "active-turn"|"on-bench", requiresEnergy, requiresInPlay? }`.

### 5.2 How the text is read (`capabilityFromEffect`)

The parser is intentionally conservative — it returns `null` (card treated as inert) unless it's confident:

1. Lowercase, collapse whitespace.
2. **Rare Candy** — text contains "skipping the Stage 1".
3. **Isolate the search object.** Capture the phrase after "search your deck for …" up to the next verb. This is what prevents false positives:
   - *Crispin* searches **Energy** then "attach … to your Pokémon" — the object is "…basic energy cards…", not a Pokémon, so it's **not** read as a Pokémon tutor.
   - *Arven* searches "an Item card and a **Pokémon Tool** card" — "Pokémon Tool" is stripped to "tool" so it reads as `search-trainer`, not a Pokémon search.
4. **Classify by the object**: bench-vs-hand, and Pokémon vs Trainer/Item vs Supporter vs whole-line (Dawn's "a Basic …, a Stage 1 …, and a Stage 2 …").
5. **Restrictions** carried onto the capability:
   - `restrict`: "doesn't have a Rule Box" → `non-rule-box`; "Evolution Pokémon" → `evolution`; "Basic Pokémon" → `basic` (tolerating an energy symbol, e.g. "Basic {F} Pokémon").
   - `energyType`: a `{F}`/`{W}`/… symbol qualifying the Pokémon (Fighting Gong's `{F}` → `Fighting`, so it can't fetch a Metal Gimmighoul).
   - `maxHp`: "70 HP or less" (Poffin).
   - `count`: "up to N".
   - `discard`: "only if you discard N/another …" → cost.
   - `coinFlip`: "Flip a coin. If heads, …" → ~50% effect.
6. **Draw**: "draw cards until you have N" → `draw-to N`; otherwise the largest "draw N" (covers "draw 6 … draw 8 instead" — we always hold 6 prizes); `shuffleHand` if the hand is shuffled into the deck / put on the bottom first.

### 5.3 Abilities (`classifyAbility`)

Runs the same `capabilityFromEffect` on each ability, then:
- **Skips** situational abilities (text mentions "Knocked Out" / "opponent's last turn") — they don't fire during setup — and passive/static abilities (no "once during your turn" and no on-bench trigger).
- `trigger`: `on-bench` if "when you play this Pokémon from your hand onto your Bench / to evolve", else `active-turn` (once per turn while in play).
- `requiresEnergy`: "discard a(n) … Energy".
- `requiresInPlay`: "if you have **X** in play" (e.g. Solrock for Lunatone).

### 5.4 Name fallback (`setup-cards.ts`)

When a card has no cached effect text (older cache entries, synthetic test cards), classification falls back to name matching for a small known set: Rare Candy, the four Balls, Professor's Research / Iono / Arven, Battle VIP Pass.

---

## 6. The greedy bot (`setup-sim.ts`)

### 6.1 State

`GameState` holds `hand`, `deck` (library), `discard`, `bench` (slots: `{name, enteredTurn, abilityUsedTurn?}`), the precomputed `rules`/`abilityRules` maps, the `target` line, the chosen `engineLines`, and `enginePartners`. Built-once-per-run via `buildSimContext` (so the deck is classified and engines selected a single time, not per game).

### 6.2 Engine selection (`selectEngines`)

The deck's best ≤2 non-target lines whose ability-bearer has a draw/search ability, ranked by `draw-value × copies`, plus any Basics those abilities require in play (`enginePartners`). A single-Basic ability holder (Genesect, Meowth) is just an engine line of length 1.

### 6.3 Turn structure

Per turn, in order:
1. **Draw** (skip turn 1 going first).
2. **Bench the target's Basic** (so search can target evolution pieces).
3. **Advance engines** — bench + evolve each engine line toward its ability-bearer; bench partners.
4. **Use draw abilities** to dig.
5. **Play one Supporter** — the highest-scoring draw/search Supporter in hand.
6. **Play Items** (no per-turn limit) — bench-basics, searches, repeatedly while useful.
7. **Advance engines** again (for pieces drawn this turn).
8. **Use search abilities** — grab the needed evolution piece (e.g. Genesect tutors Gholdengo).
9. **Evolve** the target (normal or Rare Candy).
10. **Bench** anything searched up; **success check**.

### 6.4 Decision rules

- **`nextNeededPiece`** drives search: a line Basic → the Stage 1 (if in deck and no Candy around) → the final card; Rare Candy is preferred when available because it saves a turn.
- **`ruleScore`** ranks playable cards: whole-line search > targeted Pokémon search > bench-basics (first basic > backup) > fetch-Rare-Candy/Trainer > fetch-a-Supporter > draw (dig only when stuck; never shuffle away a piece you can use this turn).
- **`pickDiscards`** never discards a line piece, Rare Candy, a Ball, or an understood Supporter; a costed Ball is skipped if there's no safe fodder.
- **Caps**: bench ≤ 5 (target prioritized), ≤ 2 line Basics in play, ≤ 2 engine lines.
- **Poffin/Nest spill**: once the target's Basics are down, bench-basics fills engine-line Basics / partners.

---

## 7. Monte Carlo & confidence (`setup-sim.ts` + `sim-stats.ts`)

`runSetupSim` runs games in chunks of 1,500 and **auto-scales**: it keeps going until the headline metric (set-up-by-final-turn) has a 95% CI half-width ≤ **±1.5%**, with a floor of 3,000 games and a hard cap of **12,000**. The actual game count is reported.

`SetupSimResult` carries `perTurnSetup[]`, `cumulativeSetup[]`, `avgSetupTurn`, `neverSetUpRate`, `mulliganRate`, `unsatisfiable`, and a 95% CI half-width for each (`cumulativeCI[]`, `avgSetupTurnCI`, …).

Confidence intervals use the **Wilson score interval** (`sim-stats.ts`), not the normal approximation, because setup rates sit near 0 (turn 1 of a Stage 2) or near 1, where the normal interval misbehaves. `avgSetupTurn` uses a sample-mean CI from a running sum-of-squares.

### Calibration ("confidence tests")

The Monte Carlo is proven unbiased against closed-form math (`setup-sim.test.ts`):
- A **draw-only** Basic line (no engine, deck padded with other Basics so mulligans are negligible) must reproduce the hypergeometric curve `oddsToSeeByTurn(60, copies, 7, extraDrawsByTurn(t, order))`, both play orders, every turn. This is exact because prizes are set aside from the *bottom* of the shuffled library, so "seen by turn ≤5" is identical to drawing from 60.
- The **mulligan rate** must match `1 − hypergeometricAtLeast(60, basics, 7, 1)`.
- The reported CI must **bracket** the true value.

If the simulation and the math ever disagree, a test goes red.

---

## 8. UI (`SetupSimPanel.vue`)

- **Going 1st / 2nd** toggle, **Re-roll** (new random seed).
- One row per line, grouped by kind ("Stage 2 · ex / V", "Basic", …).
- Columns T1–T5 show the cumulative odds the final stage is in play by that turn, each with a dim `±` (95% CI); the **Avg** column shows the mean setup turn (± in turns). Lines that can't be set up are flagged.
- The composable (`useSetupSim.ts`) fetches evolution/effect data for all non-Energy cards, debounces, and re-runs every line on deck edits / order changes.

---

## 9. Extending the simulator

- **Recognize a new effect**: extend the regex/keyword logic in `capabilityFromEffect` (or add a `Capability`). Add a test in `setup-rules.test.ts` using the card's real effect text. Prefer effect-text inference over name matching.
- **Recognize a new ability**: it flows through `classifyAbility` automatically if it's a draw/search ability with an "once during your turn" / on-bench trigger; otherwise extend the skip/trigger rules.
- **New bot behavior**: add a phase or adjust `ruleScore` in `setup-sim.ts`. Keep the calibration tests green — they guard against accidental bias.
- **Known approximations to be aware of**: energy *type* of an ability's discard cost isn't checked; partner-dependent abilities only fire if the partner gets benched; evolution-stage abilities require the bot to set that line up; typed/conditional searches are best-effort.

---

## 10. Running it

```bash
bun test src/                       # all unit tests, incl. calibration/confidence tests
bunx playwright test e2e/setup-sim.spec.ts   # e2e walk (needs dev servers on :5173/:3001)
```

In the app: open a deck → **Deck → Setup Sim**. The report covers every line in the deck.

import { ref, computed, watch } from "vue";
import { useQuery } from "@tanstack/vue-query";
import type { Card } from "../../shared/types/card.js";
import { api } from "../lib/client.js";
import { useDecklist } from "./useDecklist.js";
import {
  buildEvolutionLines,
  type SimCard,
  type EvolutionLine,
  type EvolutionAnalysis,
} from "../../shared/utils/evolution-lines.js";
import { runSetupSim, type SetupSimResult } from "../../shared/utils/setup-sim.js";
import { makeRng, type PlayOrder } from "../../shared/utils/hand-sim.js";

/**
 * Reactive shell over the setup simulator. Pulls the live working deck, fetches
 * each distinct Pokémon's evolution chain from the server, builds the deck's
 * evolution lines, and runs the Monte Carlo sim (debounced) for the chosen
 * target. All heavy logic lives in the pure modules under shared/utils.
 */

export const SETUP_TURNS = 5;
export const SETUP_ITERATIONS = 3000;

export interface SetupRow {
  line: EvolutionLine;
  result: SetupSimResult;
}

interface EvoInfo {
  stage: string | null;
  chain: string[];
  effect?: string;
  abilities?: Array<{ name: string; effect: string }>;
}

/** Attach each card's resolved chain + rules text to the flattened deck. Pure (exported for tests). */
export function attachChains(cards: Card[], evolutions: Map<string, EvoInfo>): SimCard[] {
  return cards.map((c) => {
    const info = evolutions.get(c.id);
    if (!info) return { ...c };
    return { ...c, chain: info.chain, effect: info.effect, abilities: info.abilities };
  });
}

// Module-level UI prefs so the panel keeps its state across remounts.
const order = ref<PlayOrder>("first");
const seed = ref(20260531);

export function useSetupSim() {
  const { items } = useDecklist();

  // Flatten the live deck to physical cards (classification uses `.card`, not art overrides).
  const deckCards = computed<Card[]>(() =>
    items.value.filter((i) => i.count > 0).flatMap((i) => Array(i.count).fill(i.card)),
  );
  const deckSize = computed(() => deckCards.value.length);
  const isEmpty = computed(() => deckSize.value === 0);
  const isComplete = computed(() => deckSize.value === 60);

  // Distinct card ids whose evolution chain + rules text we need (Pokémon for
  // chains/abilities, Trainers for effect-based rules).
  const cardIds = computed(() => {
    const ids = new Set<string>();
    for (const c of deckCards.value) if (c.category !== "Energy") ids.add(c.id);
    return [...ids].sort();
  });

  const evolutionsQuery = useQuery({
    queryKey: computed(() => ["card-evolutions", cardIds.value.join(",")]),
    queryFn: () => api.getCardEvolutions(cardIds.value),
    enabled: computed(() => cardIds.value.length > 0),
    staleTime: 30 * 60_000,
  });

  const evolutionsMap = computed<Map<string, EvoInfo>>(() => {
    const m = new Map<string, EvoInfo>();
    for (const e of evolutionsQuery.data.value?.evolutions ?? []) {
      m.set(e.id, { stage: e.stage, chain: e.chain, effect: e.effect, abilities: e.abilities });
    }
    return m;
  });

  const simCards = computed<SimCard[]>(() => attachChains(deckCards.value, evolutionsMap.value));

  const analysis = computed<EvolutionAnalysis>(() => buildEvolutionLines(simCards.value));
  const lines = computed<EvolutionLine[]>(() => analysis.value.lines);
  const warnings = computed(() => analysis.value.warnings);

  const isLoading = computed(
    () => cardIds.value.length > 0 && (evolutionsQuery.isLoading.value || evolutionsQuery.isFetching.value),
  );

  // Debounced Monte Carlo run for EVERY line in the deck (sorted by kind), so the
  // report covers all Pokémon at once rather than one target at a time.
  const rows = ref<SetupRow[]>([]);
  let debounce: ReturnType<typeof setTimeout> | null = null;

  function recompute() {
    if (isEmpty.value) {
      rows.value = [];
      return;
    }
    const deck = simCards.value;
    rows.value = lines.value.map((line) => ({
      line,
      result: runSetupSim({
        deck,
        line,
        iterations: SETUP_ITERATIONS,
        maxTurns: SETUP_TURNS,
        order: order.value,
        rng: makeRng(seed.value),
      }),
    }));
  }

  watch(
    [lines, order, seed, simCards],
    () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(recompute, 150);
    },
    { immediate: true },
  );

  function setOrder(o: PlayOrder) {
    order.value = o;
  }
  function reroll() {
    seed.value = (seed.value * 1664525 + 1013904223) >>> 0;
  }

  return {
    // state
    order,
    // derived
    deckCards,
    deckSize,
    isEmpty,
    isComplete,
    lines,
    warnings,
    rows,
    isLoading,
    // actions
    setOrder,
    reroll,
    // constants
    TURNS: SETUP_TURNS,
    ITERATIONS: SETUP_ITERATIONS,
  };
}

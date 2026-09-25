import { ref, computed, watch, type Ref } from "vue";
import {
  resolvePrintCounts,
  setPrintCount,
  setPrintGroup,
  fullPrintCounts,
  oneEachPrintCounts,
  sinceLastPrintCounts,
  totalPrintCopies,
  encodePrintCounts,
  type PrintCounts,
  type PrintPlanEntry,
} from "../../shared/utils/print-plan.js";

const PLAN_KEY = "decklistgen-print-plan";
const LAST_PRINTED_KEY = "decklistgen-last-printed";

function readJson(key: string): PrintCounts {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as PrintCounts) : {};
  } catch {
    return {};
  }
}

function writeJson(key: string, value: PrintCounts | null) {
  try {
    if (value === null || Object.keys(value).length === 0) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode etc. — the plan just won't survive a reload */
  }
}

/** Only the ids whose count differs from the deck, so an unchanged card follows the deck. */
function sparse(counts: PrintCounts, entries: PrintPlanEntry[]): PrintCounts {
  const out: PrintCounts = {};
  for (const e of entries) {
    const n = counts[e.id];
    if (n !== undefined && n !== e.deckCount) out[e.id] = n;
  }
  return out;
}

/**
 * Per-deck print plan for the deck grid's print mode: which cards, how many
 * copies. Overrides are stored sparsely (only cards that differ from the deck)
 * under a per-deck localStorage key so a mid-adjustment reload keeps them, and
 * a card you haven't touched always follows its deck count. The last printed
 * plan is remembered per deck so "since last print" can seed the delta.
 *
 * All math lives in shared/utils/print-plan.ts; this only holds the refs.
 */
export function usePrintPlan(deckId: Ref<string | null>, entries: Ref<PrintPlanEntry[]>) {
  const planKey = () => `${PLAN_KEY}:${deckId.value ?? "working"}`;
  const lastKey = () => `${LAST_PRINTED_KEY}:${deckId.value ?? "working"}`;

  const overrides = ref<PrintCounts>(readJson(planKey()));
  const lastPrinted = ref<PrintCounts>(readJson(lastKey()));

  watch(deckId, () => {
    overrides.value = readJson(planKey());
    lastPrinted.value = readJson(lastKey());
  });

  watch(overrides, (v) => writeJson(planKey(), v), { deep: true });

  /** Resolved plan: one entry per deck card, clamped to the deck. */
  const counts = computed(() => resolvePrintCounts(entries.value, overrides.value));
  const total = computed(() => totalPrintCopies(counts.value));
  /** Sparse `counts=` URL value; "" when the plan is "print everything". */
  const encoded = computed(() => encodePrintCounts(counts.value, entries.value));
  const hasLastPrinted = computed(() => Object.keys(lastPrinted.value).length > 0);
  const isFull = computed(() => Object.keys(sparse(counts.value, entries.value)).length === 0);

  function commit(next: PrintCounts) {
    overrides.value = sparse(next, entries.value);
  }

  function setCount(id: string, n: number) {
    commit(setPrintCount(counts.value, entries.value, id, n));
  }
  function increment(id: string) {
    setCount(id, (counts.value[id] ?? 0) + 1);
  }
  function decrement(id: string) {
    setCount(id, (counts.value[id] ?? 0) - 1);
  }
  function setGroup(ids: string[], on: boolean) {
    commit(setPrintGroup(counts.value, entries.value, ids, on));
  }
  function setAll() {
    commit(fullPrintCounts(entries.value));
  }
  function setOneEach() {
    commit(oneEachPrintCounts(entries.value));
  }
  function setSinceLastPrint() {
    commit(sinceLastPrintCounts(entries.value, lastPrinted.value));
  }

  /** Remember what just went to the printer so the next plan can start from the delta. */
  function recordPrinted() {
    // Accumulate: a partial print adds to what's already on paper, and a deck
    // that grew since then still owes only the difference.
    const next: PrintCounts = { ...lastPrinted.value };
    for (const e of entries.value) {
      next[e.id] = Math.min(e.deckCount, (next[e.id] ?? 0) + (counts.value[e.id] ?? 0));
    }
    lastPrinted.value = next;
    writeJson(lastKey(), next);
  }

  return {
    counts, total, encoded, isFull, hasLastPrinted,
    setCount, increment, decrement, setGroup, setAll, setOneEach, setSinceLastPrint,
    recordPrinted,
  };
}

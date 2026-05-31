import { ref, computed } from "vue";
import type { Card } from "../../shared/types/card.js";
import { useDecklist } from "./useDecklist.js";
import {
  dealOpeningHand,
  draw,
  DEFAULT_HAND_SIZE,
  type PlayOrder,
  type Rng,
} from "../../shared/utils/hand-sim.js";

/**
 * Interactive opening-hand tester. Thin reactive shell over the pure draw
 * helpers in `hand-sim.ts`; all probability math lives there and is unit-tested
 * separately.
 *
 * State is module-level (singleton), mirroring `useDecklist`, so the panel and
 * any other consumer share one live hand.
 */

// Module-singleton reactive state.
const hand = ref<Card[]>([]);
const rest = ref<Card[]>([]);
const turn = ref(0); // 0 = no hand drawn yet
const mulliganCount = ref(0);
const wasMulligan = ref(false);
const playOrder = ref<PlayOrder>("first");

export function useHandTester(rng: Rng = Math.random) {
  const { items } = useDecklist();

  // Flatten the live working deck to physical cards. Classification always uses
  // `.card`, never `.artCard` (art overrides are cosmetic).
  const deckCards = computed<Card[]>(() =>
    items.value.filter((i) => i.count > 0).flatMap((i) => Array(i.count).fill(i.card)),
  );

  const deckSize = computed(() => deckCards.value.length);
  const isEmpty = computed(() => deckSize.value === 0);
  const isComplete = computed(() => deckSize.value === 60);
  const handDrawn = computed(() => turn.value > 0);

  function deal() {
    const r = dealOpeningHand(deckCards.value, { order: playOrder.value, rng });
    hand.value = r.hand;
    rest.value = r.rest;
    wasMulligan.value = r.wasMulligan;
  }

  /** Draw a fresh opening hand. Gated only on an empty deck — partial decks deal fine. */
  function newHand() {
    if (isEmpty.value) {
      hand.value = [];
      rest.value = [];
      turn.value = 0;
      mulliganCount.value = 0;
      wasMulligan.value = false;
      return;
    }
    deal();
    mulliganCount.value = 0;
    turn.value = 1;
  }

  /** Reshuffle and redraw the opener, counting the mulligan. */
  function mulligan() {
    if (isEmpty.value) return;
    deal();
    mulliganCount.value++;
    turn.value = 1;
  }

  /** Draw one card for the next turn. */
  function drawNext() {
    if (rest.value.length === 0) return;
    const d = draw(rest.value, 1);
    hand.value = [...hand.value, ...d.hand];
    rest.value = d.rest;
    turn.value++;
  }

  /** Switch play order; redraw if a hand is already on the table so it reflects the change. */
  function setOrder(order: PlayOrder) {
    if (playOrder.value === order) return;
    playOrder.value = order;
    if (handDrawn.value) newHand();
  }

  return {
    // state
    hand,
    rest,
    turn,
    mulliganCount,
    wasMulligan,
    playOrder,
    // derived
    deckCards,
    deckSize,
    isEmpty,
    isComplete,
    handDrawn,
    // actions
    newHand,
    mulligan,
    drawNext,
    setOrder,
    // constant
    HAND_SIZE: DEFAULT_HAND_SIZE,
  };
}

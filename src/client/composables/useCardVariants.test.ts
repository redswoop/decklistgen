import { describe, it, expect, mock } from "bun:test";
import { ref, nextTick } from "vue";
import type { Card } from "../../shared/types/card.js";

// Stand in for the vue-query fetch: the by-name variant set the server returns.
const rawVariants = ref<Card[] | undefined>(undefined);
mock.module("./usePokeproxy.js", () => ({
  useVariants: () => ({ data: rawVariants }),
}));

const { useCardVariants } = await import("./useCardVariants.js");

function card(id: string, illustrator: string, rarity: string, mechanicsHash: string): Card {
  return { id, name: "Pikachu ex", illustrator, rarity, mechanicsHash } as Card;
}

// Prod's "Pikachu ex" by-name set, trimmed to the printings that matter.
const anniversary = card("30th-053", "5ban Graphics", "Double rare", "2d2873fa");
const paldea = card("sv02-063", "N-DESIGN Inc.", "Double rare", "a5f6c97b");
const prismatic = card("sv08.5-028", "N-DESIGN Inc.", "Double rare", "150c59ae");
const sspSurging = card("sv08-057", "aky CG Works", "Double rare", "34c2e9c0");
const ascReprint = card("me02.5-057", "aky CG Works", "Double rare", "34c2e9c0");

describe("useCardVariants", () => {
  it("shows the card the lightbox was opened on, not a same-artist different card", async () => {
    rawVariants.value = undefined;
    const active = ref(prismatic);
    const { currentCard, variantIndex, variants } = useCardVariants(active);
    expect(currentCard.value.id).toBe("sv08.5-028");

    rawVariants.value = [anniversary, paldea, prismatic];
    await nextTick();
    expect(variants.value?.map((v) => v.id)).toEqual(["30th-053", "sv02-063", "sv08.5-028"]);
    expect(variantIndex.value).toBe(2);
    expect(currentCard.value.id).toBe("sv08.5-028");
  });

  it("keeps the opened printing as its reprint group's representative", async () => {
    rawVariants.value = [anniversary, sspSurging, ascReprint];
    const active = ref(ascReprint);
    const { currentCard, variants } = useCardVariants(active);
    await nextTick();
    // SSP 057 and ASC 057 are the same card + art; the opened one wins the slot.
    expect(variants.value?.map((v) => v.id)).toEqual(["30th-053", "me02.5-057"]);
    expect(currentCard.value.id).toBe("me02.5-057");
  });

  it("falls back to the opened card, never index 0, when it is missing from the set", async () => {
    rawVariants.value = [anniversary, paldea];
    const active = ref(prismatic);
    const { currentCard, variantIndex } = useCardVariants(active);
    await nextTick();
    expect(variantIndex.value).toBe(-1);
    expect(currentCard.value.id).toBe("sv08.5-028");
  });

  it("'also printed in' lists true reprints only, not same-artist different cards", async () => {
    rawVariants.value = [paldea, prismatic, sspSurging, ascReprint];
    const { sameArtPrintings } = useCardVariants(ref(prismatic));
    await nextTick();
    expect(sameArtPrintings.value).toEqual([]);

    const ssp = useCardVariants(ref(sspSurging));
    await nextTick();
    expect(ssp.sameArtPrintings.value.map((v) => v.id)).toEqual(["me02.5-057"]);
  });

  it("re-selects when the active card changes (search-set navigation)", async () => {
    rawVariants.value = [anniversary, paldea, prismatic];
    const active = ref(prismatic);
    const { currentCard, variantIndex } = useCardVariants(active);
    await nextTick();
    expect(variantIndex.value).toBe(2);
    active.value = paldea;
    await nextTick();
    expect(variantIndex.value).toBe(1);
    expect(currentCard.value.id).toBe("sv02-063");
  });
});

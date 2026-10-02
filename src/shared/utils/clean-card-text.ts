/**
 * TCGdex leaked rendered HTML into the 30th-anniversary sets' effect text
 * (first seen 2026-10-02; 43 cards across `30th` / `30th-c`):
 *
 *   <span class="energy-symbol Lightning" title="Lightning">Lightning</span>
 *   <em>(Don't apply Weakness and Resistance for Benched Pokémon.)</em>
 *
 * Every other set writes energy as `{L}` tokens (see EnergyTokenText.vue) and
 * reminder text as plain parentheticals, so normalize to that.
 */

const TYPE_TO_CODE: Record<string, string> = {
  Grass: "G", Fire: "R", Water: "W", Lightning: "L", Psychic: "P",
  Fighting: "F", Darkness: "D", Metal: "M", Fairy: "Y", Dragon: "N", Colorless: "C",
};

const ENERGY_SPAN = /<span\s+class="energy-symbol\s+([A-Za-z]+)"[^>]*>[^<]*<\/span>/g;
const ANY_TAG = /<\/?[a-z][^>]*>/gi;

export function cleanCardText(text: string): string;
export function cleanCardText(text: string | undefined): string | undefined;
export function cleanCardText(text: string | undefined): string | undefined {
  if (text === undefined || !text.includes("<")) return text;
  return text
    .replace(ENERGY_SPAN, (m, type: string) => {
      const code = TYPE_TO_CODE[type];
      return code ? `{${code}}` : m.replace(ANY_TAG, "");
    })
    .replace(ANY_TAG, "");
}

interface HasEffect { effect?: string }

/** Clean every free-text field on a raw TCGdex card, in place. Returns it for chaining. */
export function cleanTcgdexCardText<T extends {
  attacks?: HasEffect[];
  abilities?: HasEffect[];
  effect?: string;
  description?: string;
}>(raw: T): T {
  for (const a of raw.attacks ?? []) if (a.effect) a.effect = cleanCardText(a.effect);
  for (const a of raw.abilities ?? []) if (a.effect) a.effect = cleanCardText(a.effect);
  if (raw.effect) raw.effect = cleanCardText(raw.effect);
  if (raw.description) raw.description = cleanCardText(raw.description);
  return raw;
}

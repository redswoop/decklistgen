import type { TcgdexCard } from "../../shared/types/card.js";

/**
 * Compute a hash of gameplay-relevant fields so that variant matching
 * only groups cards with identical mechanics.
 */
export function computeMechanicsHash(raw: TcgdexCard): string {
  const category = raw.category ?? "Pokemon";

  if (category === "Energy") {
    // Basic energy (no effect text) → fixed string
    if (!raw.effect) return "basic";
    // Special energy → hash the effect
    return hash({ effect: normalize(raw.effect) });
  }

  if (category === "Trainer") {
    return hash({
      trainerType: raw.trainerType ?? "",
      effect: normalize(raw.effect ?? ""),
    });
  }

  // Pokemon: hash gameplay-relevant stats
  const attacks = (raw.attacks ?? [])
    .map((a) => ({
      name: a.name ?? "",
      cost: (a.cost ?? []).slice().sort(),
      damage: String(a.damage ?? ""),
      effect: normalize(a.effect ?? ""),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const abilities = (raw.abilities ?? [])
    .map((a) => ({
      name: a.name ?? "",
      type: a.type ?? "",
      effect: normalize(a.effect ?? ""),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const weaknesses = (raw.weaknesses ?? [])
    .slice()
    .sort((a, b) => a.type.localeCompare(b.type));

  const resistances = (raw.resistances ?? [])
    .slice()
    .sort((a, b) => a.type.localeCompare(b.type));

  return hash({
    hp: raw.hp ?? 0,
    retreat: raw.retreat ?? 0,
    stage: raw.stage ?? "",
    attacks,
    abilities,
    weaknesses,
    resistances,
  });
}

/** Energy symbol shorthand → full name mapping used by TCGdex. */
const ENERGY_SYMBOLS: Record<string, string> = {
  G: "Grass", R: "Fire", W: "Water", L: "Lightning",
  P: "Psychic", F: "Fighting", D: "Darkness", M: "Metal",
  Y: "Fairy", N: "Dragon", C: "Colorless",
};

/** Normalize effect text for stable hashing:
 *  - Replace {G}/{R}/etc. shorthand with full energy names
 *  - Collapse whitespace */
function normalize(text: string): string {
  return text
    .replace(/\{([A-Z])\}/g, (_, letter) => ENERGY_SYMBOLS[letter] ?? letter)
    .replace(/\s+/g, " ")
    .trim();
}

/** JSON-stringify the input and return the first 8 hex chars of its MD5. */
function hash(data: unknown): string {
  const hasher = new Bun.CryptoHasher("md5");
  hasher.update(JSON.stringify(data));
  return hasher.digest("hex").slice(0, 8);
}

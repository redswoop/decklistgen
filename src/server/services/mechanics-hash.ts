import type { TcgdexCard } from "../../shared/types/card.js";

/**
 * Compute a hash for variant matching. Two cards with the same name
 * and the same mechanicsHash are considered art variants of each other.
 *
 * For Pokemon, we hash only the sorted ability names + attack names.
 * This is intentionally lenient: reprints with slightly different text,
 * errata, or missing weakness/resistance data in TCGdex still match as
 * long as the named moves and abilities are the same.
 *
 * For Trainers, we hash the trainerType (Supporter/Item/Tool/Stadium).
 * Same-name trainers are always the same card mechanically.
 *
 * For Energy, basic energy (no effect) returns "basic". Special energy
 * (has effect) returns "special" — the name match handles identity.
 */
export function computeMechanicsHash(raw: TcgdexCard): string {
  const category = raw.category ?? "Pokemon";

  if (category === "Energy") {
    return raw.effect ? "special" : "basic";
  }

  if (category === "Trainer") {
    return hash({ trainerType: raw.trainerType ?? "" });
  }

  // Pokemon: hash only the sorted names of abilities and attacks
  const abilityNames = (raw.abilities ?? [])
    .map((a) => a.name ?? "")
    .sort();

  const attackNames = (raw.attacks ?? [])
    .map((a) => a.name ?? "")
    .sort();

  return hash({ abilityNames, attackNames });
}

/** JSON-stringify the input and return the first 8 hex chars of its MD5. */
function hash(data: unknown): string {
  const hasher = new Bun.CryptoHasher("md5");
  hasher.update(JSON.stringify(data));
  return hasher.digest("hex").slice(0, 8);
}

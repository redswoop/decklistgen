/**
 * Adapter: production Card / CardDetail → lab card shapes.
 *
 * Bridges the main app's enriched Card model and the CSS card renderer's
 * hand-authored LabCard / LabTrainerCard / LabBasicEnergyCard shapes. The lab
 * was built with a tighter, lab-local type so the sandbox could iterate without
 * dragging in the full enrichment pipeline; this module is the only place that
 * crosses the two.
 *
 * Lives in client/ rather than shared/ because LabCard is intentionally
 * client-only (the lab types live under src/client/lab/) — keeping shared/
 * importable from server is more valuable than co-locating the adapter.
 */
import type { Card, CardDetail } from "../../shared/types/card.js";
import type {
  EnergyType,
  NameSuffix,
  Stage,
  LabAttack,
  LabCard,
  LabTrainerCard,
  LabBasicEnergyCard,
  TrainerType,
} from "../lab/types.js";

const KNOWN_ENERGY_TYPES: ReadonlySet<EnergyType> = new Set([
  "Grass", "Fire", "Water", "Lightning", "Psychic", "Fighting",
  "Darkness", "Metal", "Fairy", "Dragon", "Colorless",
]);

function toEnergyType(raw: string | undefined): EnergyType {
  if (raw && KNOWN_ENERGY_TYPES.has(raw as EnergyType)) return raw as EnergyType;
  return "Colorless";
}

function pickSuffix(card: Card): NameSuffix | undefined {
  // Precedence: VSTAR → VMAX → V → ex. A card never has more than one of
  // these in practice, but order matters if upstream data is dirty.
  if (card.isVstar) return "VSTAR";
  if (card.isVmax) return "VMAX";
  if (card.isV) return "V";
  if (card.isEx) return "ex";
  return undefined;
}

/**
 * Strip the suffix token from the card's name. The lab's NameCluster renders
 * the suffix as a PNG logo next to the base name, so the raw " ex" / " V" /
 * " VMAX" / " VSTAR" tail in the Card model would double up. Mirrors
 * `splitNameSuffix()` in src/server/services/pokeproxy/svg-helpers.ts.
 */
function stripSuffix(name: string, suffix: NameSuffix | undefined): string {
  if (!suffix) return name;
  if (suffix === "ex" && name.toLowerCase().endsWith(" ex")) return name.slice(0, -3).trimEnd();
  if (suffix === "V" && name.endsWith(" V")) return name.slice(0, -2).trimEnd();
  if (suffix === "VMAX" && name.endsWith(" VMAX")) return name.slice(0, -5).trimEnd();
  if (suffix === "VSTAR" && name.endsWith(" VSTAR")) return name.slice(0, -6).trimEnd();
  return name;
}

function pickStage(rawStage: string | undefined): Stage | undefined {
  if (rawStage === "Basic" || rawStage === "Stage1" || rawStage === "Stage2") {
    return rawStage;
  }
  // VMAX / VSTAR / Mega etc. — the lab's StagePill falls back to the suffix
  // logo treatment, so leave the stage undefined.
  return undefined;
}

function mapAttack(atk: { name: string; cost: string[]; damage?: string; effect?: string }): LabAttack {
  return {
    name: atk.name,
    cost: atk.cost.map(toEnergyType),
    damage: atk.damage,
    effect: atk.effect,
  };
}

function mapMatchup(m: { type: string; value: string } | undefined): { type: EnergyType; value: string } | undefined {
  if (!m) return undefined;
  return { type: toEnergyType(m.type), value: m.value };
}

const TRAINER_TYPE_MAP: Partial<Record<string, TrainerType>> = {
  Item: "Item",
  Supporter: "Supporter",
  Tool: "Tool",
  Stadium: "Stadium",
};

export function adaptPokemon(card: Card, detail: CardDetail | undefined, artUrl: string): LabCard {
  if (detail && detail.abilities.length > 1) {
    // Lab only renders the first ability for now; flag the gap so we notice.
    // eslint-disable-next-line no-console
    console.warn(`[card-to-lab] ${card.id} has ${detail.abilities.length} abilities; only the first will render.`);
  }
  const ability = detail?.abilities?.[0];
  const suffix = pickSuffix(card);
  return {
    name: stripSuffix(card.name, suffix),
    suffix,
    evolvesFrom: detail?.evolveFrom,
    stage: pickStage(card.stage),
    type: toEnergyType(card.energyTypes[0]),
    hp: card.hp ?? 0,
    artUrl,
    ability: ability ? { name: ability.name, effect: ability.effect } : undefined,
    attacks: (detail?.attacks ?? []).map(mapAttack),
    weakness: mapMatchup(detail?.weaknesses?.[0]),
    resistance: mapMatchup(detail?.resistances?.[0]),
    retreat: card.retreat ?? 0,
    illustrator: card.illustrator || undefined,
  };
}

export function adaptTrainer(card: Card, detail: CardDetail | undefined, artUrl: string): LabTrainerCard {
  const trainerType: TrainerType = card.category === "Energy"
    ? "Special Energy"
    : (TRAINER_TYPE_MAP[card.trainerType ?? ""] ?? "Item");
  return {
    name: card.name,
    trainerType,
    artUrl,
    illustrator: card.illustrator || undefined,
    effect: detail?.effect,
    // ability / vstarPower / attacks / ruleText: V1 leaves these undefined.
    // Seal Stone-style VSTAR Powers and ACE SPEC attached attacks need
    // structured data the Card model doesn't carry yet; route in once
    // we have a real-world test case.
  };
}

export function adaptBasicEnergy(card: Card, artUrl: string): LabBasicEnergyCard {
  const footer = `${card.setName} • ${card.localId}`;
  return {
    name: card.name,
    energyType: toEnergyType(card.energyTypes[0]),
    artUrl,
    footer,
  };
}

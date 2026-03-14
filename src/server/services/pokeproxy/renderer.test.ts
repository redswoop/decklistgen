import { describe, test, expect, beforeEach } from "bun:test";
import { Resvg } from "@resvg/resvg-js";
import { renderFromTemplate, resetIconIds } from "./templates/index.js";
import type { TemplateName } from "./templates/index.js";

// Tiny 1x1 white PNG as placeholder image (base64)
const TINY_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

function renderStandard(card: Record<string, unknown>) {
  return renderFromTemplate("standard", card, TINY_PNG);
}
function renderFullart(card: Record<string, unknown>) {
  return renderFromTemplate("fullart", card, TINY_PNG);
}
function renderBasicEnergy(card: Record<string, unknown>) {
  return renderFromTemplate("basic-energy", card, TINY_PNG);
}
function renderVstar(card: Record<string, unknown>) {
  return renderFromTemplate("vstar", card, TINY_PNG);
}

// ─── Test card fixtures ───

const CARDS = {
  basicPokemon: {
    name: "Sprigatito",
    category: "Pokemon",
    hp: 70,
    types: ["Grass"],
    stage: "Basic",
    retreat: 1,
    localId: "001",
    set: { name: "Scarlet & Violet", id: "sv01" },
    attacks: [
      { name: "Scratch", damage: "20", cost: ["Colorless"] },
    ],
  },
  stage1Pokemon: {
    name: "Floragato",
    category: "Pokemon",
    hp: 90,
    types: ["Grass"],
    stage: "Stage1",
    retreat: 1,
    localId: "006",
    evolveFrom: "Sprigatito",
    set: { name: "Scarlet & Violet", id: "sv01" },
    abilities: [
      { type: "Ability", name: "Fragrant Flower Garden", effect: "Once during your turn, you may heal 20 damage from each of your Pokemon." },
    ],
    attacks: [
      { name: "Razor Leaf", damage: "50", cost: ["Grass", "Colorless"] },
    ],
  },
  exPokemon: {
    name: "Arcanine ex",
    category: "Pokemon",
    hp: 280,
    types: ["Fire"],
    stage: "Stage1",
    suffix: "ex",
    rarity: "Double Rare",
    retreat: 3,
    localId: "019",
    evolveFrom: "Growlithe",
    set: { name: "Scarlet & Violet", id: "sv01" },
    attacks: [
      { name: "Inferno Fang", damage: "120", cost: ["Fire", "Fire", "Colorless"], effect: "Discard 2 Energy from this Pokémon." },
      { name: "Heat Blast", damage: "200", cost: ["Fire", "Fire", "Fire", "Colorless"] },
    ],
  },
  vPokemon: {
    name: "Zacian V",
    category: "Pokemon",
    hp: 220,
    types: ["Metal"],
    stage: "Basic",
    suffix: "V",
    rarity: "Ultra Rare",
    retreat: 2,
    localId: "16",
    set: { name: "Celebrations", id: "cel25" },
    abilities: [
      { type: "Ability", name: "Intrepid Sword", effect: "Once during your turn, you may look at the top 3 cards of your deck, put any number of Metal Energy cards you find there into your hand, and put the rest on the bottom of your deck." },
    ],
    attacks: [
      { name: "Brave Blade", damage: "230", cost: ["Metal", "Metal", "Metal"], effect: "During your next turn, this Pokémon can't attack." },
    ],
  },
  vmaxPokemon: {
    name: "Flygon VMAX",
    category: "Pokemon",
    hp: 320,
    types: ["Dragon"],
    stage: "VMAX",
    suffix: "VMAX",
    rarity: "Rare VMAX",
    retreat: 2,
    localId: "7",
    evolveFrom: "Flygon V",
    set: { name: "Celebrations", id: "cel25" },
    attacks: [
      { name: "Max Spiral", damage: "180", cost: ["Fighting", "Fighting"], effect: "Attach an Energy card from your discard pile to this Pokémon." },
    ],
  },
  vstarPokemon: {
    name: "Leafeon VSTAR",
    category: "Pokemon",
    hp: 260,
    types: ["Grass"],
    stage: "VSTAR",
    suffix: "VSTAR",
    rarity: "Rare VSTAR",
    retreat: 1,
    localId: "019",
    evolveFrom: "Leafeon V",
    set: { name: "Crown Zenith", id: "swsh12.5" },
    attacks: [
      { name: "Leaf Guard", damage: "180", cost: ["Grass", "Colorless", "Colorless"], effect: "During your opponent's next turn, this Pokémon takes 30 less damage from attacks." },
    ],
  },
  vstarWithAbility: {
    name: "Mawile VSTAR",
    category: "Pokemon",
    hp: 260,
    types: ["Psychic"],
    stage: "VSTAR",
    suffix: "V",
    rarity: "Holo Rare VSTAR",
    retreat: 1,
    localId: "071",
    evolveFrom: "Mawile V",
    set: { name: "Silver Tempest", id: "swsh12" },
    abilities: [
      { type: "Ability", name: "Star Rondo", effect: "During your turn, if this Pokémon is on your Bench, you may switch it with your Active Pokémon. If you do, switch 1 of your opponent's Benched Pokémon with their Active Pokémon. (You can't use more than 1 VSTAR Power in a game.)" },
    ],
    attacks: [
      { name: "Sudden Eater", damage: "90+", cost: ["Colorless", "Colorless"], effect: "If this Pokémon moved from your Bench to the Active Spot this turn, this attack does 90 more damage." },
    ],
  },
  vstarWithPowerAttack: {
    name: "Charizard VSTAR",
    category: "Pokemon",
    hp: 280,
    types: ["Fire"],
    stage: "VSTAR",
    suffix: "V",
    rarity: "Holo Rare VSTAR",
    retreat: 2,
    localId: "019",
    evolveFrom: "Charizard V",
    set: { name: "Crown Zenith", id: "swsh12.5" },
    attacks: [
      { name: "Explosive Fire", damage: "130+", cost: ["Fire", "Fire", "Colorless"], effect: "If this Pokémon has any damage counters on it, this attack does 100 more damage." },
      { name: "Star Blaze", damage: "320", cost: ["Fire", "Fire", "Fire", "Colorless"], effect: "Discard 2 Energy from this Pokémon. (You can't use more than 1 VSTAR Power in a game.)" },
    ],
  },
  trainerItem: {
    name: "Rare Candy",
    category: "Trainer",
    trainerType: "Item",
    rarity: "Uncommon",
    localId: "172",
    set: { name: "Scarlet & Violet", id: "sv01" },
    effect: "Choose 1 of your Basic Pokémon in play. If you have a Stage 2 card in your hand that evolves from that Pokémon, put that card onto the Basic Pokémon to evolve it, skipping the Stage 1.",
  },
  trainerSupporter: {
    name: "Professor's Research (Professor Sada)",
    category: "Trainer",
    trainerType: "Supporter",
    rarity: "Uncommon",
    localId: "175",
    set: { name: "Scarlet & Violet", id: "sv01" },
    effect: "Discard your hand and draw 7 cards.",
  },
  trainerStadium: {
    name: "Artazon",
    category: "Trainer",
    trainerType: "Stadium",
    rarity: "Uncommon",
    localId: "196",
    set: { name: "Obsidian Flames", id: "sv03" },
    effect: "Once during each player's turn, that player may search their deck for a Basic Pokémon that doesn't have a Rule Box and put it onto their Bench. Then, that player shuffles their deck.",
  },
  trainerTool: {
    name: "Exp. Share",
    category: "Trainer",
    trainerType: "Tool",
    rarity: "Uncommon",
    localId: "173",
    set: { name: "Paldea Evolved", id: "sv02" },
    effect: "When your Active Pokémon is Knocked Out by damage from an attack from your opponent's Pokémon, you may move 1 Basic Energy from that Pokémon to the Pokémon this card is attached to.",
  },
  basicEnergy: {
    name: "Basic Darkness Energy",
    category: "Energy",
    energyType: "Normal",
    types: ["Darkness"],
    localId: "098",
    set: { name: "Shrouded Fable", id: "sv06.5" },
  },
  specialEnergy: {
    name: "Spiky Energy",
    category: "Energy",
    energyType: "Special",
    types: ["Colorless"],
    localId: "190",
    set: { name: "Surging Sparks", id: "sv09" },
    effect: "This card provides {C} Energy only while it is attached to a Pokémon. When you attach this card from your hand, put 3 damage counters on your opponent's Active Pokémon.",
  },
  dragonPokemon: {
    name: "Giratina ex",
    category: "Pokemon",
    hp: 330,
    types: ["Dragon"],
    stage: "Stage1",
    suffix: "ex",
    rarity: "Double Rare",
    retreat: 2,
    localId: "073",
    set: { name: "Prismatic Evolutions", id: "sv08.5" },
    attacks: [
      { name: "Shadow Force", damage: "280", cost: ["Grass", "Psychic", "Colorless"], effect: "During your next turn, this Pokémon can't attack." },
    ],
  },
  textHeavyPokemon: {
    name: "Mewtwo",
    category: "Pokemon",
    hp: 130,
    types: ["Psychic"],
    stage: "Basic",
    retreat: 2,
    localId: "21",
    set: { name: "Celebrations", id: "cel25" },
    abilities: [
      { type: "Ability", name: "Pressure", effect: "As long as this Pokémon is in the Active Spot, your opponent's Pokémon's attacks cost {C} more." },
    ],
    attacks: [
      { name: "Psyburn", damage: "90", cost: ["Psychic", "Psychic", "Colorless"] },
      { name: "Psystrike", damage: "150", cost: ["Psychic", "Psychic", "Psychic"], effect: "This attack's damage isn't affected by any effects on your opponent's Active Pokémon." },
    ],
  },
};

// ─── SVG structure tests ───

describe("standard renderer", () => {
  beforeEach(() => resetIconIds());

  test("basic pokemon produces valid SVG", () => {
    const svg = renderStandard(CARDS.basicPokemon);
    expect(svg).toStartWith("<svg");
    expect(svg).toEndWith("</svg>");
    expect(svg).toContain("Sprigatito");
    expect(svg).toContain("70 HP");
    expect(svg).toContain("Scratch");
  });

  test("stage 1 pokemon shows evolution line", () => {
    const svg = renderStandard(CARDS.stage1Pokemon);
    expect(svg).toContain("Evolves from Sprigatito");
    expect(svg).toContain("Fragrant Flower Garden");
  });

  test("trainer item renders correctly", () => {
    const svg = renderStandard(CARDS.trainerItem);
    expect(svg).toContain("Rare Candy");
    expect(svg).not.toContain(" HP</text>");
  });

  test("trainer supporter renders name", () => {
    const svg = renderStandard(CARDS.trainerSupporter);
    expect(svg).toContain("Professor");
  });

  test("trainer stadium renders correctly", () => {
    const svg = renderStandard(CARDS.trainerStadium);
    expect(svg).toContain("Artazon");
  });

  test("text-heavy pokemon fits without error", () => {
    const svg = renderStandard(CARDS.textHeavyPokemon);
    expect(svg).toContain("Pressure");
    expect(svg).toContain("Psyburn");
    expect(svg).toContain("Psystrike");
  });

  test("text compression is applied", () => {
    const svg = renderStandard(CARDS.trainerTool);
    expect(svg).toContain("KO");
    expect(svg).not.toContain("Knocked Out");
  });
});

describe("fullart renderer", () => {
  beforeEach(() => resetIconIds());

  test("ex pokemon renders with ex logo", () => {
    const svg = renderFullart(CARDS.exPokemon);
    expect(svg).toStartWith("<svg");
    expect(svg).toContain("Arcanine");
    expect(svg).toContain("280");
  });

  test("V pokemon renders with big V logo", () => {
    const svg = renderFullart(CARDS.vPokemon);
    expect(svg).toContain("Zacian");
    expect(svg).toContain("BASIC");
    expect(svg).toContain("Intrepid Sword");
    // Should contain embedded V logo image
    expect(svg).toContain("data:image/png;base64,");
  });

  test("VMAX pokemon renders with VMAX badge", () => {
    const svg = renderFullart(CARDS.vmaxPokemon);
    expect(svg).toContain("Flygon");
    expect(svg).toContain("grad-VMAX");
  });

  test("VSTAR pokemon renders with VSTAR badge (fullart fallback)", () => {
    const svg = renderFullart(CARDS.vstarPokemon);
    expect(svg).toContain("Leafeon");
    expect(svg).toContain("grad-VSTAR");
  });

  test("dragon type renders dragon icon paths", () => {
    const svg = renderFullart(CARDS.dragonPokemon);
    expect(svg).toContain("Giratina");
    expect(svg).toContain("#576fbc");
  });

  test("special energy renders with ENERGY header", () => {
    const svg = renderFullart(CARDS.specialEnergy);
    expect(svg).toContain("ENERGY");
    expect(svg).toContain("SPECIAL");
    expect(svg).toContain("Spiky Energy");
  });

  test("trainer supporter renders with subtitle split", () => {
    const svg = renderFullart(CARDS.trainerSupporter);
    expect(svg).toContain("TRAINER");
    expect(svg).toContain("SUPPORTER");
    expect(svg).toContain("Professor");
    expect(svg).toContain("Professor Sada");
  });

  test("rules text rendered for ex pokemon", () => {
    const svg = renderFullart(CARDS.exPokemon);
    expect(svg).toContain("KO");
    expect(svg).toContain("2 Prizes");
  });

  test("weakness/resistance rendered for typed pokemon", () => {
    const svg = renderFullart(CARDS.exPokemon);
    expect(svg).toContain("×2");
  });
});

describe("vstar renderer", () => {
  beforeEach(() => resetIconIds());

  test("VSTAR pokemon renders with gold VSTAR tag and suffix", () => {
    const svg = renderVstar(CARDS.vstarPokemon);
    expect(svg).toStartWith("<svg");
    expect(svg).toEndWith("</svg>");
    expect(svg).toContain("Leafeon");
    expect(svg).toContain("VSTAR");
    expect(svg).toContain("Leaf Guard");
  });

  test("VSTAR with ability renders attack before ability", () => {
    const svg = renderVstar(CARDS.vstarWithAbility);
    expect(svg).toContain("Mawile");
    expect(svg).toContain("Sudden Eater");
    expect(svg).toContain("Star Rondo");
    // "VSTAR Power" label separate from ability name
    expect(svg).toContain("VSTAR Power");
    expect(svg).not.toContain("VSTAR Power:");
    // Attack should appear before the VSTAR Power ability in the SVG
    const attackIdx = svg.indexOf("Sudden Eater");
    const abilityIdx = svg.indexOf("Star Rondo");
    expect(attackIdx).toBeLessThan(abilityIdx);
  });

  test("VSTAR Power renders once-per-game note", () => {
    const svg = renderVstar(CARDS.vstarWithAbility);
    expect(svg).toContain("VSTAR Power in a game");
    // No gold shimmer bar or star glyph
    expect(svg).not.toContain("vstar-bar-grad");
    expect(svg).not.toContain("&#x2605;");
    expect(svg).not.toContain("gold-glow");
  });

  test("VSTAR Power attack renders with VSTAR Power styling", () => {
    const svg = renderVstar(CARDS.vstarWithPowerAttack);
    expect(svg).toContain("Charizard");
    expect(svg).toContain("Explosive Fire");
    expect(svg).toContain("Star Blaze");
    expect(svg).toContain("VSTAR Power");
    expect(svg).toContain("VSTAR Power in a game");
    // Explosive Fire (regular) should appear before Star Blaze (VSTAR Power)
    const regularIdx = svg.indexOf("Explosive Fire");
    const vstarIdx = svg.indexOf("Star Blaze");
    expect(regularIdx).toBeLessThan(vstarIdx);
    // VSTAR Power label should appear before Star Blaze
    const labelIdx = svg.indexOf("VSTAR Power");
    expect(labelIdx).toBeLessThan(vstarIdx);
  });

  test("VSTAR renders evolution line", () => {
    const svg = renderVstar(CARDS.vstarPokemon);
    expect(svg).toContain("Evolves from Leafeon V");
  });

  test("VSTAR renders rules text", () => {
    const svg = renderVstar(CARDS.vstarPokemon);
    expect(svg).toContain("KO");
    expect(svg).toContain("2 Prizes");
  });
});

describe("basic energy renderer", () => {
  beforeEach(() => resetIconIds());

  test("renders minimal SVG with full card image", () => {
    const svg = renderBasicEnergy(CARDS.basicEnergy);
    expect(svg).toStartWith("<svg");
    expect(svg).toEndWith("</svg>");
    expect(svg).toContain("Shrouded Fable");
    expect(svg).not.toContain("font-weight=\"900\"");
  });

  test("uses correct type color for border", () => {
    const svg = renderBasicEnergy(CARDS.basicEnergy);
    expect(svg).toContain("#3E2D68");
  });
});

// ─── SVG snapshot tests ───

describe("SVG snapshots", () => {
  beforeEach(() => resetIconIds());

  test("standard pokemon SVG is deterministic", () => {
    resetIconIds();
    const svg1 = renderStandard(CARDS.basicPokemon);
    resetIconIds();
    const svg2 = renderStandard(CARDS.basicPokemon);
    expect(svg1).toBe(svg2);
  });

  test("fullart SVG is deterministic", () => {
    resetIconIds();
    const svg1 = renderFullart(CARDS.exPokemon);
    resetIconIds();
    const svg2 = renderFullart(CARDS.exPokemon);
    expect(svg1).toBe(svg2);
  });

  test("basic energy SVG is deterministic", () => {
    resetIconIds();
    const svg1 = renderBasicEnergy(CARDS.basicEnergy);
    resetIconIds();
    const svg2 = renderBasicEnergy(CARDS.basicEnergy);
    expect(svg1).toBe(svg2);
  });
});

// ─── Image rendering tests (SVG → PNG via resvg) ───

import { join } from "node:path";
const FONT_DIR = join(import.meta.dir, "./fonts");

function renderSvgToPng(svg: string): Buffer {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: 375 },
    font: { loadSystemFonts: true, fontDirs: [FONT_DIR] },
  });
  return Buffer.from(resvg.render().asPng());
}

function pngDimensions(png: Buffer): { width: number; height: number } {
  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
  };
}

describe("SVG → PNG rendering", () => {
  beforeEach(() => resetIconIds());

  test("standard pokemon renders to valid PNG", () => {
    const svg = renderStandard(CARDS.basicPokemon);
    const png = renderSvgToPng(svg);
    expect(png.length).toBeGreaterThan(100);
    expect(png[0]).toBe(0x89);
    expect(png[1]).toBe(0x50);
    expect(png[2]).toBe(0x4e);
    expect(png[3]).toBe(0x47);
    const dims = pngDimensions(png);
    expect(dims.width).toBe(375);
    expect(dims.height).toBeGreaterThan(500);
    expect(dims.height).toBeLessThan(550);
  });

  test("fullart ex renders to valid PNG", () => {
    const svg = renderFullart(CARDS.exPokemon);
    const png = renderSvgToPng(svg);
    expect(png[0]).toBe(0x89);
    const dims = pngDimensions(png);
    expect(dims.width).toBe(375);
  });

  test("basic energy renders to valid PNG", () => {
    const svg = renderBasicEnergy(CARDS.basicEnergy);
    const png = renderSvgToPng(svg);
    expect(png[0]).toBe(0x89);
    const dims = pngDimensions(png);
    expect(dims.width).toBe(375);
  });

  test("all card types render without error", () => {
    const TEMPLATE_MAP: Record<string, TemplateName> = {};
    for (const [label, card] of Object.entries(CARDS)) {
      const category = (card as any).category;
      const stage = (card as any).stage;
      const isEnergy = category === "Energy";
      const isBasicEnergy = isEnergy && (card as any).energyType === "Normal";
      const isVstar = stage === "VSTAR";
      const isFullart = !isBasicEnergy && !isVstar && (
        (card as any).suffix || (card as any).rarity?.toLowerCase().includes("rare") || isEnergy
      );
      TEMPLATE_MAP[label] = isBasicEnergy ? "basic-energy" : isVstar ? "vstar" : isFullart ? "fullart" : "standard";
    }

    const results: Record<string, { svgLen: number; pngLen: number; width: number; height: number }> = {};
    for (const [label, card] of Object.entries(CARDS)) {
      resetIconIds();
      const svg = renderFromTemplate(TEMPLATE_MAP[label], card, TINY_PNG);
      const png = renderSvgToPng(svg);
      const dims = pngDimensions(png);
      results[label] = { svgLen: svg.length, pngLen: png.length, ...dims };
      expect(png[0]).toBe(0x89);
      expect(dims.width).toBe(375);
    }

    console.log("\n--- Render results ---");
    for (const [label, r] of Object.entries(results)) {
      console.log(
        `${label.padEnd(22)} svg=${String(r.svgLen).padStart(6)} bytes  png=${String(r.pngLen).padStart(6)} bytes  ${r.width}x${r.height}`,
      );
    }
  });

  test("same input produces identical PNG output", () => {
    resetIconIds();
    const svg1 = renderStandard(CARDS.basicPokemon);
    const png1 = renderSvgToPng(svg1);

    resetIconIds();
    const svg2 = renderStandard(CARDS.basicPokemon);
    const png2 = renderSvgToPng(svg2);

    expect(Buffer.compare(png1, png2)).toBe(0);
  });
});

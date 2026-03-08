import { describe, test, expect, beforeEach } from "bun:test";
import { Resvg } from "@resvg/resvg-js";
import {
  generateStandardSvg,
  generateFullartSvg,
  generateBasicEnergySvg,
  resetIconIds,
} from "./renderer.js";

// Tiny 1x1 white PNG as placeholder image (base64)
const TINY_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

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
    const svg = generateStandardSvg(CARDS.basicPokemon, TINY_PNG);
    expect(svg).toStartWith("<svg");
    expect(svg).toEndWith("</svg>");
    expect(svg).toContain("Sprigatito");
    expect(svg).toContain("70 HP");
    expect(svg).toContain("Scratch");
  });

  test("stage 1 pokemon shows evolution line", () => {
    const svg = generateStandardSvg(CARDS.stage1Pokemon, TINY_PNG);
    expect(svg).toContain("Evolves from Sprigatito");
    expect(svg).toContain("Fragrant Flower Garden");
  });

  test("trainer item renders correctly", () => {
    const svg = generateStandardSvg(CARDS.trainerItem, TINY_PNG);
    expect(svg).toContain("Rare Candy");
    // Should not have HP
    expect(svg).not.toContain(" HP</text>");
  });

  test("trainer supporter renders name and subtitle split", () => {
    const svg = generateStandardSvg(CARDS.trainerSupporter, TINY_PNG);
    expect(svg).toContain("Professor");
  });

  test("trainer stadium renders correctly", () => {
    const svg = generateStandardSvg(CARDS.trainerStadium, TINY_PNG);
    expect(svg).toContain("Artazon");
  });

  test("text-heavy pokemon fits without error", () => {
    const svg = generateStandardSvg(CARDS.textHeavyPokemon, TINY_PNG);
    expect(svg).toContain("Pressure");
    expect(svg).toContain("Psyburn");
    expect(svg).toContain("Psystrike");
  });

  test("text compression is applied", () => {
    const svg = generateStandardSvg(CARDS.trainerTool, TINY_PNG);
    // "is Knocked Out by damage from an attack from your opponent's Pokémon"
    // should be compressed to "is KO'd by opponent"
    expect(svg).toContain("KO");
    expect(svg).not.toContain("Knocked Out");
  });
});

describe("fullart renderer", () => {
  beforeEach(() => resetIconIds());

  test("ex pokemon renders with suffix badge", () => {
    const svg = generateFullartSvg(CARDS.exPokemon, TINY_PNG);
    expect(svg).toStartWith("<svg");
    expect(svg).toContain("Arcanine");
    expect(svg).toContain("grad-ex");
    expect(svg).toContain("280");
  });

  test("V pokemon renders correctly", () => {
    const svg = generateFullartSvg(CARDS.vPokemon, TINY_PNG);
    expect(svg).toContain("Zacian");
    expect(svg).toContain("grad-V");
    expect(svg).toContain("Intrepid Sword");
  });

  test("VMAX pokemon renders with VMAX badge", () => {
    const svg = generateFullartSvg(CARDS.vmaxPokemon, TINY_PNG);
    expect(svg).toContain("Flygon");
    expect(svg).toContain("grad-VMAX");
    expect(svg).toContain("Evolves from Flygon V");
  });

  test("VSTAR pokemon renders with VSTAR badge", () => {
    const svg = generateFullartSvg(CARDS.vstarPokemon, TINY_PNG);
    expect(svg).toContain("Leafeon");
    expect(svg).toContain("grad-VSTAR");
  });

  test("dragon type renders dragon icon paths", () => {
    const svg = generateFullartSvg(CARDS.dragonPokemon, TINY_PNG);
    expect(svg).toContain("Giratina");
    // Dragon icons use SVG path fallback instead of font glyph
    expect(svg).toContain("#576fbc");
  });

  test("special energy renders as fullart with ENERGY header", () => {
    const svg = generateFullartSvg(CARDS.specialEnergy, TINY_PNG);
    expect(svg).toContain("ENERGY");
    expect(svg).toContain("SPECIAL");
    expect(svg).toContain("Spiky Energy");
  });

  test("trainer supporter renders with subtitle split", () => {
    const svg = generateFullartSvg(CARDS.trainerSupporter, TINY_PNG);
    expect(svg).toContain("TRAINER");
    expect(svg).toContain("SUPPORTER");
    expect(svg).toContain("Professor");
    // Subtitle (Professor Sada) should render on second line
    expect(svg).toContain("Professor Sada");
  });

  test("rules text rendered for ex pokemon", () => {
    const svg = generateFullartSvg(CARDS.exPokemon, TINY_PNG);
    expect(svg).toContain("KO");
    expect(svg).toContain("2 Prizes");
  });

  test("weakness/resistance rendered for typed pokemon", () => {
    const svg = generateFullartSvg(CARDS.exPokemon, TINY_PNG);
    // Fire weakness is Water ×2
    expect(svg).toContain("×2");
  });
});

describe("basic energy renderer", () => {
  beforeEach(() => resetIconIds());

  test("renders minimal SVG with full card image", () => {
    const svg = generateBasicEnergySvg(CARDS.basicEnergy, TINY_PNG);
    expect(svg).toStartWith("<svg");
    expect(svg).toEndWith("</svg>");
    expect(svg).toContain("Shrouded Fable");
    // Should NOT contain ability/attack bars
    expect(svg).not.toContain("font-weight=\"900\"");
  });

  test("uses correct type color for border", () => {
    const svg = generateBasicEnergySvg(CARDS.basicEnergy, TINY_PNG);
    // Darkness type color
    expect(svg).toContain("#3E2D68");
  });
});

// ─── SVG snapshot tests ───

describe("SVG snapshots", () => {
  beforeEach(() => resetIconIds());

  test("standard pokemon SVG is deterministic", () => {
    resetIconIds();
    const svg1 = generateStandardSvg(CARDS.basicPokemon, TINY_PNG);
    resetIconIds();
    const svg2 = generateStandardSvg(CARDS.basicPokemon, TINY_PNG);
    expect(svg1).toBe(svg2);
  });

  test("fullart SVG is deterministic", () => {
    resetIconIds();
    const svg1 = generateFullartSvg(CARDS.exPokemon, TINY_PNG);
    resetIconIds();
    const svg2 = generateFullartSvg(CARDS.exPokemon, TINY_PNG);
    expect(svg1).toBe(svg2);
  });

  test("basic energy SVG is deterministic", () => {
    resetIconIds();
    const svg1 = generateBasicEnergySvg(CARDS.basicEnergy, TINY_PNG);
    resetIconIds();
    const svg2 = generateBasicEnergySvg(CARDS.basicEnergy, TINY_PNG);
    expect(svg1).toBe(svg2);
  });
});

// ─── Image rendering tests (SVG → PNG via resvg) ───

import { join } from "node:path";
const FONT_DIR = join(import.meta.dir, "../../../../pokeproxy/fonts");

function renderSvgToPng(svg: string): Buffer {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: 375 },
    font: { loadSystemFonts: true, fontDirs: [FONT_DIR] },
  });
  return Buffer.from(resvg.render().asPng());
}

function pngDimensions(png: Buffer): { width: number; height: number } {
  // PNG header: width at offset 16, height at offset 20 (big-endian uint32)
  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
  };
}

describe("SVG → PNG rendering", () => {
  beforeEach(() => resetIconIds());

  test("standard pokemon renders to valid PNG", () => {
    const svg = generateStandardSvg(CARDS.basicPokemon, TINY_PNG);
    const png = renderSvgToPng(svg);
    expect(png.length).toBeGreaterThan(100);
    // Check PNG magic bytes
    expect(png[0]).toBe(0x89);
    expect(png[1]).toBe(0x50); // P
    expect(png[2]).toBe(0x4e); // N
    expect(png[3]).toBe(0x47); // G
    const dims = pngDimensions(png);
    expect(dims.width).toBe(375);
    // Card ratio is 5:7, so height ≈ 525
    expect(dims.height).toBeGreaterThan(500);
    expect(dims.height).toBeLessThan(550);
  });

  test("fullart ex renders to valid PNG", () => {
    const svg = generateFullartSvg(CARDS.exPokemon, TINY_PNG);
    const png = renderSvgToPng(svg);
    expect(png[0]).toBe(0x89);
    const dims = pngDimensions(png);
    expect(dims.width).toBe(375);
  });

  test("basic energy renders to valid PNG", () => {
    const svg = generateBasicEnergySvg(CARDS.basicEnergy, TINY_PNG);
    const png = renderSvgToPng(svg);
    expect(png[0]).toBe(0x89);
    const dims = pngDimensions(png);
    expect(dims.width).toBe(375);
  });

  test("all card types render without error", () => {
    const results: Record<string, { svgLen: number; pngLen: number; width: number; height: number }> = {};

    for (const [label, card] of Object.entries(CARDS)) {
      resetIconIds();
      const category = (card as any).category;
      const isEnergy = category === "Energy";
      const isBasicEnergy = isEnergy && (card as any).energyType === "Normal";
      const isFullart = !isBasicEnergy && (
        (card as any).suffix || (card as any).rarity?.toLowerCase().includes("rare") || isEnergy
      );

      let svg: string;
      if (isBasicEnergy) {
        svg = generateBasicEnergySvg(card, TINY_PNG);
      } else if (isFullart) {
        svg = generateFullartSvg(card, TINY_PNG);
      } else {
        svg = generateStandardSvg(card, TINY_PNG);
      }

      const png = renderSvgToPng(svg);
      const dims = pngDimensions(png);
      results[label] = { svgLen: svg.length, pngLen: png.length, ...dims };

      expect(png[0]).toBe(0x89); // valid PNG
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
    const svg1 = generateStandardSvg(CARDS.basicPokemon, TINY_PNG);
    const png1 = renderSvgToPng(svg1);

    resetIconIds();
    const svg2 = generateStandardSvg(CARDS.basicPokemon, TINY_PNG);
    const png2 = renderSvgToPng(svg2);

    expect(Buffer.compare(png1, png2)).toBe(0);
  });
});

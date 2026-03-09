import { describe, test, expect, beforeEach } from "bun:test";
import { Resvg } from "@resvg/resvg-js";
import { join } from "node:path";
import { resolve } from "./resolve.js";
import { renderWithLayout } from "./index.js";
import { resetIconIds } from "../type-icons.js";
import { box, row, column, text, icon, spacer } from "./helpers.js";

const TINY_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

const FONT_DIR = join(import.meta.dir, "../fonts");

function renderSvgToPng(svg: string): Buffer {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: 375 },
    font: { loadSystemFonts: true, fontDirs: [FONT_DIR] },
  });
  return Buffer.from(resvg.render().asPng());
}

function pngDimensions(png: Buffer): { width: number; height: number } {
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

// ── Test cards ──

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
  trainerItem: {
    name: "Rare Candy",
    category: "Trainer",
    trainerType: "Item",
    rarity: "Uncommon",
    localId: "172",
    set: { name: "Scarlet & Violet", id: "sv01" },
    effect: "Choose 1 of your Basic Pokémon in play. If you have a Stage 2 card in your hand that evolves from that Pokémon, put that card onto the Basic Pokémon to evolve it, skipping the Stage 1.",
  },
};

// ── Resolver unit tests ──

describe("layout resolver", () => {
  test("column layout positions children vertically", () => {
    const tree = column({ width: 200, height: 100 }, [
      box({ height: 30 }, []),
      box({ height: 30 }, []),
    ]);
    const r = resolve(tree, 200, 100);
    expect(r.children).toHaveLength(2);
    expect(r.children![0].y).toBe(0);
    expect(r.children![0].height).toBe(30);
    expect(r.children![1].y).toBe(30);
    expect(r.children![1].height).toBe(30);
  });

  test("column with gap adds spacing", () => {
    const tree = column({ width: 200, height: 100, gap: 10 }, [
      box({ height: 30 }, []),
      box({ height: 30 }, []),
    ]);
    const r = resolve(tree, 200, 100);
    expect(r.children![0].y).toBe(0);
    expect(r.children![1].y).toBe(40);
  });

  test("flex children split remaining space", () => {
    const tree = column({ width: 200, height: 100 }, [
      box({ height: 40 }, []),
      box({ flex: 1 }, []),
    ]);
    const r = resolve(tree, 200, 100);
    expect(r.children![1].height).toBe(60);
  });

  test("row layout positions children horizontally", () => {
    const tree = row({ width: 200, height: 50 }, [
      box({ width: 60, height: 50 }, []),
      box({ width: 80, height: 50 }, []),
    ]);
    const r = resolve(tree, 200, 50);
    expect(r.children![0].x).toBe(0);
    expect(r.children![0].width).toBe(60);
    expect(r.children![1].x).toBe(60);
    expect(r.children![1].width).toBe(80);
  });

  test("row with flex spacer", () => {
    const tree = row({ width: 200, height: 50 }, [
      box({ width: 50, height: 50 }, []),
      spacer(1),
      box({ width: 50, height: 50 }, []),
    ]);
    const r = resolve(tree, 200, 50);
    expect(r.children![0].x).toBe(0);
    expect(r.children![1].width).toBe(100);
    expect(r.children![2].x).toBe(150);
  });

  test("padding offsets children", () => {
    const tree = column({ width: 200, height: 100, padding: 10 }, [
      box({ height: 30 }, []),
    ]);
    const r = resolve(tree, 200, 100);
    expect(r.children![0].x).toBe(10);
    expect(r.children![0].y).toBe(10);
    expect(r.children![0].width).toBe(180);
  });
});

// ── Full render tests ──

describe("layout standard renderer", () => {
  beforeEach(() => resetIconIds());

  test("basic pokemon produces valid SVG", () => {
    const svg = renderWithLayout(CARDS.basicPokemon, TINY_PNG);
    expect(svg).toStartWith("<svg");
    expect(svg).toEndWith("</svg>");
    expect(svg).toContain("Sprigatito");
    expect(svg).toContain(">HP</text>");
    expect(svg).toContain(">70</text>");
    expect(svg).toContain("Scratch");
  });

  test("basic pokemon renders to valid PNG", () => {
    resetIconIds();
    const svg = renderWithLayout(CARDS.basicPokemon, TINY_PNG);
    const png = renderSvgToPng(svg);
    expect(png.length).toBeGreaterThan(100);
    expect(png[0]).toBe(0x89); // PNG magic
    expect(png[1]).toBe(0x50);
    const dims = pngDimensions(png);
    expect(dims.width).toBe(375);
    expect(dims.height).toBeGreaterThan(500);
  });

  test("SVG is deterministic", () => {
    resetIconIds();
    const svg1 = renderWithLayout(CARDS.basicPokemon, TINY_PNG);
    resetIconIds();
    const svg2 = renderWithLayout(CARDS.basicPokemon, TINY_PNG);
    expect(svg1).toBe(svg2);
  });

  test("text-heavy pokemon renders without error", () => {
    const svg = renderWithLayout(CARDS.textHeavyPokemon, TINY_PNG);
    expect(svg).toContain("Pressure");
    expect(svg).toContain("Psyburn");
    expect(svg).toContain("Psystrike");
  });

  test("ex pokemon renders with ex logo", () => {
    const svg = renderWithLayout(CARDS.exPokemon, TINY_PNG);
    expect(svg).toContain("Arcanine");
    expect(svg).toContain("data:image/png;base64,");
    expect(svg).toContain("KO");
  });

  test("trainer item renders correctly", () => {
    const svg = renderWithLayout(CARDS.trainerItem, TINY_PNG);
    expect(svg).toContain("Rare Candy");
    expect(svg).not.toContain(" HP</text>");
  });

  test("contains energy type icon", () => {
    const svg = renderWithLayout(CARDS.basicPokemon, TINY_PNG);
    // Should contain a Grass type icon
    expect(svg).toContain("#439837");
  });

  test("contains set info", () => {
    const svg = renderWithLayout(CARDS.basicPokemon, TINY_PNG);
    expect(svg).toContain("Scarlet &amp; Violet");
    expect(svg).toContain("001");
  });
});

#!/usr/bin/env bun
/**
 * Render sample cards to PNG files for visual inspection.
 * Usage: bun src/server/services/pokeproxy/render-samples.ts
 * Output: cache/samples/*.png
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { renderFromTemplate, resetIconIds } from "./templates/index.js";
import type { TemplateName } from "./templates/index.js";

const OUT_DIR = join(import.meta.dir, "../../../../cache/samples");
const FONT_DIR = join(import.meta.dir, "./fonts");
mkdirSync(OUT_DIR, { recursive: true });

// 1x1 white PNG placeholder
const TINY_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

const CARDS: Record<string, { card: Record<string, unknown>; template: TemplateName }> = {
  "01-basic-pokemon": {
    template: "standard",
    card: { name: "Sprigatito", category: "Pokemon", hp: 70, types: ["Grass"], stage: "Basic", retreat: 1, localId: "001", set: { name: "Scarlet & Violet" }, attacks: [{ name: "Scratch", damage: "20", cost: ["Colorless"] }] },
  },
  "02-stage1-pokemon": {
    template: "standard",
    card: { name: "Floragato", category: "Pokemon", hp: 90, types: ["Grass"], stage: "Stage1", retreat: 1, localId: "006", evolveFrom: "Sprigatito", set: { name: "Scarlet & Violet" }, abilities: [{ type: "Ability", name: "Fragrant Flower Garden", effect: "Once during your turn, you may heal 20 damage from each of your Pokemon." }], attacks: [{ name: "Razor Leaf", damage: "50", cost: ["Grass", "Colorless"] }] },
  },
  "03-ex-fullart": {
    template: "fullart",
    card: { name: "Arcanine ex", category: "Pokemon", hp: 280, types: ["Fire"], stage: "Stage1", suffix: "ex", rarity: "Double Rare", retreat: 3, localId: "019", evolveFrom: "Growlithe", set: { name: "Scarlet & Violet" }, attacks: [{ name: "Inferno Fang", damage: "120", cost: ["Fire", "Fire", "Colorless"], effect: "Discard 2 Energy from this Pokémon." }, { name: "Heat Blast", damage: "200", cost: ["Fire", "Fire", "Fire", "Colorless"] }] },
  },
  "04-v-fullart": {
    template: "fullart",
    card: { name: "Zacian V", category: "Pokemon", hp: 220, types: ["Metal"], stage: "Basic", suffix: "V", rarity: "Ultra Rare", retreat: 2, localId: "16", set: { name: "Celebrations" }, abilities: [{ type: "Ability", name: "Intrepid Sword", effect: "Once during your turn, you may look at the top 3 cards of your deck, put any number of Metal Energy cards you find there into your hand, and put the rest on the bottom of your deck." }], attacks: [{ name: "Brave Blade", damage: "230", cost: ["Metal", "Metal", "Metal"], effect: "During your next turn, this Pokémon can't attack." }] },
  },
  "05-vmax-fullart": {
    template: "fullart",
    card: { name: "Flygon VMAX", category: "Pokemon", hp: 320, types: ["Dragon"], stage: "VMAX", suffix: "VMAX", rarity: "Rare VMAX", retreat: 2, localId: "7", evolveFrom: "Flygon V", set: { name: "Celebrations" }, attacks: [{ name: "Max Spiral", damage: "180", cost: ["Fighting", "Fighting"], effect: "Attach an Energy card from your discard pile to this Pokémon." }] },
  },
  "06-vstar": {
    template: "vstar",
    card: { name: "Leafeon VSTAR", category: "Pokemon", hp: 260, types: ["Grass"], stage: "VSTAR", suffix: "VSTAR", rarity: "Rare VSTAR", retreat: 1, localId: "019", evolveFrom: "Leafeon V", set: { name: "Crown Zenith" }, attacks: [{ name: "Leaf Guard", damage: "180", cost: ["Grass", "Colorless", "Colorless"], effect: "During your opponent's next turn, this Pokémon takes 30 less damage from attacks." }] },
  },
  "06b-vstar-with-ability": {
    template: "vstar",
    card: { name: "Mawile VSTAR", category: "Pokemon", hp: 260, types: ["Psychic"], stage: "VSTAR", suffix: "V", rarity: "Holo Rare VSTAR", retreat: 1, localId: "071", evolveFrom: "Mawile V", set: { name: "Silver Tempest" }, abilities: [{ type: "Ability", name: "Star Rondo", effect: "During your turn, if this Pokémon is on your Bench, you may switch it with your Active Pokémon. If you do, switch 1 of your opponent's Benched Pokémon with their Active Pokémon. (You can't use more than 1 VSTAR Power in a game.)" }], attacks: [{ name: "Sudden Eater", damage: "90+", cost: ["Colorless", "Colorless"], effect: "If this Pokémon moved from your Bench to the Active Spot this turn, this attack does 90 more damage." }] },
  },
  "07-trainer-item": {
    template: "standard",
    card: { name: "Rare Candy", category: "Trainer", trainerType: "Item", rarity: "Uncommon", localId: "172", set: { name: "Scarlet & Violet" }, effect: "Choose 1 of your Basic Pokémon in play. If you have a Stage 2 card in your hand that evolves from that Pokémon, put that card onto the Basic Pokémon to evolve it, skipping the Stage 1." },
  },
  "08-trainer-supporter": {
    template: "fullart",
    card: { name: "Professor's Research (Professor Sada)", category: "Trainer", trainerType: "Supporter", rarity: "Uncommon", localId: "175", set: { name: "Scarlet & Violet" }, effect: "Discard your hand and draw 7 cards." },
  },
  "09-trainer-stadium": {
    template: "standard",
    card: { name: "Artazon", category: "Trainer", trainerType: "Stadium", rarity: "Uncommon", localId: "196", set: { name: "Obsidian Flames" }, effect: "Once during each player's turn, that player may search their deck for a Basic Pokémon that doesn't have a Rule Box and put it onto their Bench. Then, that player shuffles their deck." },
  },
  "10-basic-energy": {
    template: "basic-energy",
    card: { name: "Basic Darkness Energy", category: "Energy", types: ["Darkness"], localId: "098", set: { name: "Shrouded Fable" } },
  },
  "11-special-energy": {
    template: "fullart",
    card: { name: "Spiky Energy", category: "Energy", types: ["Colorless"], localId: "190", set: { name: "Surging Sparks" }, effect: "This card provides {C} Energy only while it is attached to a Pokémon. When you attach this card from your hand, put 3 damage counters on your opponent's Active Pokémon." },
  },
  "12-dragon-ex": {
    template: "fullart",
    card: { name: "Giratina ex", category: "Pokemon", hp: 330, types: ["Dragon"], stage: "Stage1", suffix: "ex", rarity: "Double Rare", retreat: 2, localId: "073", set: { name: "Prismatic Evolutions" }, attacks: [{ name: "Shadow Force", damage: "280", cost: ["Grass", "Psychic", "Colorless"], effect: "During your next turn, this Pokémon can't attack." }] },
  },
  "13-text-heavy": {
    template: "standard",
    card: { name: "Mewtwo", category: "Pokemon", hp: 130, types: ["Psychic"], stage: "Basic", retreat: 2, localId: "21", set: { name: "Celebrations" }, abilities: [{ type: "Ability", name: "Pressure", effect: "As long as this Pokémon is in the Active Spot, your opponent's Pokémon's attacks cost {C} more." }], attacks: [{ name: "Psyburn", damage: "90", cost: ["Psychic", "Psychic", "Colorless"] }, { name: "Psystrike", damage: "150", cost: ["Psychic", "Psychic", "Psychic"], effect: "This attack's damage isn't affected by any effects on your opponent's Active Pokémon." }] },
  },
};

console.log(`Rendering ${Object.keys(CARDS).length} sample cards to ${OUT_DIR}/`);

for (const [filename, { card, template }] of Object.entries(CARDS)) {
  resetIconIds();
  const svg = renderFromTemplate(template, card, TINY_PNG);

  writeFileSync(join(OUT_DIR, `${filename}.svg`), svg);
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 750 }, font: { loadSystemFonts: true, fontDirs: [FONT_DIR] } });
  const png = resvg.render().asPng();
  writeFileSync(join(OUT_DIR, `${filename}.png`), png);
  console.log(`  ${filename}.png  (${(png.length / 1024).toFixed(0)}KB)`);
}

console.log(`\nDone! Open ${OUT_DIR}/ to view.`);

/** Dev preview for the new layout engine. Hit /dev/layout in your browser. */

import { Hono } from "hono";
import { renderWithLayout } from "../services/pokeproxy/layout/index.js";
import { renderFromTemplate, resetIconIds } from "../services/pokeproxy/templates/index.js";

const TINY_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

const CARDS: Record<string, { card: Record<string, unknown>; template: "standard" | "fullart" | "basic-energy" }> = {
  sprigatito: {
    template: "standard",
    card: { name: "Sprigatito", category: "Pokemon", hp: 70, types: ["Grass"], stage: "Basic", retreat: 1, localId: "001", set: { name: "Scarlet & Violet" }, attacks: [{ name: "Scratch", damage: "20", cost: ["Colorless"] }] },
  },
  mewtwo: {
    template: "standard",
    card: { name: "Mewtwo", category: "Pokemon", hp: 130, types: ["Psychic"], stage: "Basic", retreat: 2, localId: "21", set: { name: "Celebrations" }, abilities: [{ type: "Ability", name: "Pressure", effect: "As long as this Pokémon is in the Active Spot, your opponent's Pokémon's attacks cost {C} more." }], attacks: [{ name: "Psyburn", damage: "90", cost: ["Psychic", "Psychic", "Colorless"] }, { name: "Psystrike", damage: "150", cost: ["Psychic", "Psychic", "Psychic"], effect: "This attack's damage isn't affected by any effects on your opponent's Active Pokémon." }] },
  },
  arcanine: {
    template: "standard",
    card: { name: "Arcanine ex", category: "Pokemon", hp: 280, types: ["Fire"], stage: "Stage1", suffix: "ex", retreat: 3, localId: "019", evolveFrom: "Growlithe", set: { name: "Scarlet & Violet" }, attacks: [{ name: "Inferno Fang", damage: "120", cost: ["Fire", "Fire", "Colorless"], effect: "Discard 2 Energy from this Pokémon." }, { name: "Heat Blast", damage: "200", cost: ["Fire", "Fire", "Fire", "Colorless"] }] },
  },
  floragato: {
    template: "standard",
    card: { name: "Floragato", category: "Pokemon", hp: 90, types: ["Grass"], stage: "Stage1", retreat: 1, localId: "006", evolveFrom: "Sprigatito", set: { name: "Scarlet & Violet" }, abilities: [{ type: "Ability", name: "Fragrant Flower Garden", effect: "Once during your turn, you may heal 20 damage from each of your Pokemon." }], attacks: [{ name: "Razor Leaf", damage: "50", cost: ["Grass", "Colorless"] }] },
  },
  candy: {
    template: "standard",
    card: { name: "Rare Candy", category: "Trainer", trainerType: "Item", localId: "172", set: { name: "Scarlet & Violet" }, effect: "Choose 1 of your Basic Pokémon in play. If you have a Stage 2 card in your hand that evolves from that Pokémon, put that card onto the Basic Pokémon to evolve it, skipping the Stage 1." },
  },
  supporter: {
    template: "standard",
    card: { name: "Professor's Research (Professor Sada)", category: "Trainer", trainerType: "Supporter", localId: "175", set: { name: "Scarlet & Violet" }, effect: "Discard your hand and draw 7 cards." },
  },
  stadium: {
    template: "standard",
    card: { name: "Artazon", category: "Trainer", trainerType: "Stadium", localId: "196", set: { name: "Obsidian Flames" }, effect: "Once during each player's turn, that player may search their deck for a Basic Pokémon that doesn't have a Rule Box and put it onto their Bench. Then, that player shuffles their deck." },
  },
};

const app = new Hono();

app.get("/", (c) => {
  const cardKey = c.req.query("card") ?? "sprigatito";
  const entry = CARDS[cardKey];
  if (!entry) {
    return c.text(`Unknown card. Try: ${Object.keys(CARDS).join(", ")}`, 400);
  }

  resetIconIds();
  const newSvg = renderWithLayout(entry.card, TINY_PNG);
  resetIconIds();
  const oldSvg = renderFromTemplate(entry.template, entry.card, TINY_PNG);

  const cardLinks = Object.keys(CARDS)
    .map(k => k === cardKey ? `<strong>${k}</strong>` : `<a href="?card=${k}">${k}</a>`)
    .join(" | ");

  return c.html(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Layout Dev — ${cardKey}</title>
<style>
  body { background: #1a1a2e; color: #eee; font-family: system-ui; margin: 0; padding: 16px; }
  h1 { font-size: 18px; margin: 0 0 8px; }
  .nav { margin-bottom: 16px; font-size: 14px; }
  .nav a { color: #f39c12; }
  .compare { display: flex; gap: 32px; justify-content: center; }
  .panel { text-align: center; }
  .panel h2 { font-size: 14px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
  .panel svg { width: 375px; height: auto; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.5); }
</style>
</head>
<body>
  <h1>Layout Engine Dev Preview</h1>
  <div class="nav">${cardLinks}</div>
  <div class="compare">
    <div class="panel">
      <h2>New (Layout Engine)</h2>
      ${newSvg}
    </div>
    <div class="panel">
      <h2>Old (Template)</h2>
      ${oldSvg}
    </div>
  </div>
</body>
</html>`);
});

export default app;

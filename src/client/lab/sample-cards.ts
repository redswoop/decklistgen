import type { LabCard, LabTrainerCard } from "./types";

/*
 * Hand-authored lab trainers. Renders ahead of SAMPLE_CARDS so the gallery
 * leads with the trainer variants (Supporter / Tool with VSTAR Power / Item).
 *
 * Effect strings come straight from the cached TCGdex data:
 *   sv02-254  — Iono (Ultra Rare fullart)
 *   sv01-249  — Arven (Special Illustration Rare)
 *   swsh12-156 — Forest Seal Stone (Tool with VSTAR Power "Star Alchemy")
 *   sv03.5-206 — Switch (Hyper Rare; no clean art cached, shows dark fallback)
 *
 * Forest Seal Stone splits the raw cached effect string into three pieces:
 *   intro line  → effect field (the "attached Pokémon V" attachment rule)
 *   middle line → vstarPower.name
 *   tail        → vstarPower.effect (with the "(You can't use…)" rule note)
 */
export const SAMPLE_TRAINERS: LabTrainerCard[] = [
  {
    name: "Iono",
    trainerType: "Supporter",
    artUrl: "/api/pokeproxy/image/sv02-254/clean",
    illustrator: "sadaji",
    effect: "Each player shuffles their hand and puts it on the bottom of their deck. If either player put any cards on the bottom of their deck in this way, each player draws a card for each of their remaining Prize cards.",
    ruleText: "You may play only 1 Supporter card during your turn.",
  },
  {
    name: "Arven",
    trainerType: "Supporter",
    artUrl: "/api/pokeproxy/image/sv01-249/clean",
    illustrator: "Akira Komayama",
    effect: "Search your deck for an Item card and a Pokémon Tool card, reveal them, and put them into your hand. Then, shuffle your deck.",
    ruleText: "You may play only 1 Supporter card during your turn.",
  },
  {
    name: "Forest Seal Stone",
    trainerType: "Tool",
    artUrl: "/api/pokeproxy/image/swsh12-156/clean",
    illustrator: "5ban Graphics",
    effect: "The Pokémon V this card is attached to can use the VSTAR Power on this card.",
    vstarPower: {
      kind: "ability",
      name: "Star Alchemy",
      effect: "During your turn, you may search your deck for a card and put it into your hand. Then, shuffle your deck. (You can't use more than 1 VSTAR Power in a game.)",
    },
    ruleText: "Attach a Pokémon Tool to 1 of your Pokémon that doesn't already have a Pokémon Tool attached to it.",
  },
  {
    name: "Switch",
    trainerType: "Item",
    artUrl: "/api/pokeproxy/image/me01-130/clean",
    illustrator: "Studio Bora Inc.",
    effect: "Switch your Active Pokémon with 1 of your Benched Pokémon.",
  },
];


/*
 * Hand-authored lab cards. Real card data sourced from cache/<id>.json.
 * Art URLs hit the dev server's /api/pokeproxy/image/:id/clean endpoint —
 * each id below has a confirmed _clean.png in the local cache.
 *
 * Weakness/resistance fields aren't always in the cached TCGdex JSON;
 * type-matchup defaults are filled in by convention where missing.
 */
export const SAMPLE_CARDS: LabCard[] = [
  {
    name: "Lunala",
    evolvesFrom: "Cosmoem",
    stage: "Stage2",
    type: "Psychic",
    hp: 160,
    artUrl: "/api/pokeproxy/image/cel25-15/clean",
    illustrator: "kirisAki",
    attacks: [
      {
        name: "Lunar Pain",
        cost: ["Colorless", "Colorless"],
        effect: "Double the number of damage counters on each of your opponent's Pokémon.",
      },
      {
        name: "Psychic Transfer",
        cost: ["Psychic", "Psychic", "Colorless"],
        damage: "120",
        effect: "Move any number of Energy from this Pokémon to your Benched Pokémon in any way you like.",
      },
    ],
    weakness: { type: "Darkness", value: "×2" },
    retreat: 2,
  },
  {
    name: "Zekrom",
    stage: "Basic",
    type: "Lightning",
    hp: 130,
    artUrl: "/api/pokeproxy/image/cel25-10/clean",
    illustrator: "Aya Kusube",
    attacks: [
      {
        name: "Field Crush",
        cost: ["Colorless", "Colorless"],
        damage: "30",
        effect: "If your opponent has a Stadium in play, discard it.",
      },
      {
        name: "White Thunder",
        cost: ["Lightning", "Lightning", "Colorless"],
        damage: "80+",
        effect: "If Reshiram is on your Bench, this attack does 80 more damage.",
      },
    ],
    weakness: { type: "Fighting", value: "×2" },
    resistance: { type: "Metal", value: "−30" },
    retreat: 2,
  },
  {
    name: "Meowscarada",
    suffix: "ex",
    evolvesFrom: "Floragato",
    stage: "Stage2",
    type: "Grass",
    hp: 310,
    artUrl: "/api/pokeproxy/image/sv02-256/clean",
    illustrator: "Kouki Saitou",
    ability: {
      name: "Bouquet Magic",
      effect: "You must discard a Basic Grass Energy card from your hand in order to use this Ability. Once during your turn, you may put 3 damage counters on 1 of your opponent's Benched Pokémon.",
    },
    attacks: [
      {
        name: "Scratching Nails",
        cost: ["Colorless", "Colorless"],
        damage: "100+",
        effect: "If your opponent's Active Pokémon already has any damage counters on it, this attack does 120 more damage.",
      },
    ],
    weakness: { type: "Fire", value: "×2" },
    retreat: 2,
  },
  {
    name: "Mega Feraligatr",
    suffix: "ex",
    stage: "Stage2",
    type: "Water",
    hp: 370,
    artUrl: "/api/pokeproxy/image/me02.5-274/clean",
    illustrator: "Souichirou Gunjima",
    attacks: [
      {
        name: "Mortal Crunch",
        cost: ["Water", "Water", "Colorless"],
        damage: "200+",
        effect: "If your opponent's Active Pokémon already has any damage counters on it, this attack does 200 more damage.",
      },
    ],
    weakness: { type: "Lightning", value: "×2" },
    retreat: 3,
  },
  {
    name: "Mega Charizard X",
    suffix: "ex",
    stage: "Stage2",
    type: "Fire",
    hp: 360,
    artUrl: "/api/pokeproxy/image/me02-125/clean",
    attacks: [
      {
        name: "Inferno X",
        cost: ["Fire", "Fire"],
        damage: "90×",
        effect: "Discard any amount of Fire Energy from among your Pokémon, and this attack does 90 damage for each card you discarded in this way.",
      },
    ],
    weakness: { type: "Water", value: "×2" },
    retreat: 2,
  },
  {
    name: "Mega Charizard Y",
    suffix: "ex",
    stage: "Stage2",
    type: "Fire",
    hp: 360,
    artUrl: "/api/pokeproxy/image/me02.5-294/clean",
    illustrator: "aky CG Works",
    attacks: [
      {
        name: "Explosion Y",
        cost: ["Fire", "Fire", "Colorless"],
        effect: "Discard 3 Energy from this Pokémon, and this attack does 280 damage to 1 of your opponent's Pokémon. (Don't apply Weakness and Resistance for Benched Pokémon.)",
      },
    ],
    weakness: { type: "Water", value: "×2" },
    retreat: 1,
  },
  {
    name: "Flying Pikachu",
    suffix: "VMAX",
    evolvesFrom: "Flying Pikachu V",
    type: "Lightning",
    hp: 310,
    artUrl: "/api/pokeproxy/image/cel25-7/clean",
    illustrator: "aky CG Works",
    attacks: [
      {
        name: "Max Balloon",
        cost: ["Lightning", "Colorless", "Colorless"],
        damage: "160",
        effect: "During your opponent's next turn, prevent all damage done to this Pokémon by attacks from Basic Pokémon.",
      },
    ],
    weakness: { type: "Lightning", value: "×2" },
    resistance: { type: "Fighting", value: "−30" },
    retreat: 0,
  },
  /*
   * V card — exercises the pokemon-v.png logo. Surfing Pikachu V (cel25-8)
   * pairs naturally with the Flying Pikachu VMAX above (same Celebrations set).
   */
  {
    name: "Surfing Pikachu",
    suffix: "V",
    stage: "Basic",
    type: "Lightning",
    hp: 200,
    artUrl: "/api/pokeproxy/image/cel25-8/clean",
    illustrator: "aky CG Works",
    attacks: [
      {
        name: "Surf",
        cost: ["Water", "Water", "Water"],
        damage: "150",
      },
    ],
    weakness: { type: "Fighting", value: "×2" },
    retreat: 1,
  },
  /*
   * VSTAR card — exercises the pokemon-vstar.png logo. Charizard VSTAR
   * has two attacks (regular + VSTAR Power), so the content panel grows
   * to its tallest realistic state.
   */
  {
    name: "Charizard",
    suffix: "VSTAR",
    evolvesFrom: "Charizard V",
    type: "Fire",
    hp: 280,
    artUrl: "/api/pokeproxy/image/swsh12.5-019/clean",
    illustrator: "5ban Graphics",
    attacks: [
      {
        name: "Explosive Fire",
        cost: ["Fire", "Fire", "Colorless"],
        damage: "130+",
        effect: "If this Pokémon has any damage counters on it, this attack does 100 more damage.",
      },
      {
        name: "Star Blaze",
        cost: ["Fire", "Fire", "Fire", "Colorless"],
        damage: "320",
        effect: "Discard 2 Energy from this Pokémon. (You can't use more than 1 VSTAR Power in a game.)",
      },
    ],
    weakness: { type: "Water", value: "×2" },
    retreat: 2,
  },
  /*
   * Inline-energy-token test card — Volcanion (me01-025) has the real
   * tokenized effect "Put 2 {R} Energy attached to this Pokémon into
   * your hand." This is the canonical case for verifying that the lab's
   * EnergyTokenText component matches the SVG renderer's
   * expandEnergyTokens() output.
   */
  {
    name: "Volcanion",
    stage: "Basic",
    type: "Fire",
    hp: 130,
    artUrl: "/api/pokeproxy/image/me01-025/clean",
    illustrator: "GIDORA",
    attacks: [
      {
        name: "Singe",
        cost: ["Fire"],
        effect: "Your opponent's Active Pokémon is now Burned.",
      },
      {
        name: "Backfire",
        cost: ["Fire", "Fire", "Colorless"],
        damage: "130",
        effect: "Put 2 {R} Energy attached to this Pokémon into your hand.",
      },
    ],
    weakness: { type: "Water", value: "×2" },
    retreat: 2,
  },
];

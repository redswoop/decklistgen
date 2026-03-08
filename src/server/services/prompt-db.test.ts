import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs";
import { join } from "node:path";

const PROMPTS_PATH = join(import.meta.dir, "../../../data/prompts.json");
const PROMPTS_BACKUP = PROMPTS_PATH + ".bak";

// Import after setup so the module loads the real file
let getPromptForCard: typeof import("./prompt-db.js").getPromptForCard;
let saveCardPrompt: typeof import("./prompt-db.js").saveCardPrompt;

beforeAll(async () => {
  // Back up prompts.json so we can restore after override test
  if (existsSync(PROMPTS_PATH)) {
    copyFileSync(PROMPTS_PATH, PROMPTS_BACKUP);
  }
  const mod = await import("./prompt-db.js");
  getPromptForCard = mod.getPromptForCard;
  saveCardPrompt = mod.saveCardPrompt;
});

afterAll(() => {
  // Restore original prompts.json
  if (existsSync(PROMPTS_BACKUP)) {
    copyFileSync(PROMPTS_BACKUP, PROMPTS_PATH);
  }
});

// Minimal card shapes matching what prompt-db expects
const CARDS = {
  standardPokemon: {
    id: "sv01-001",
    localId: "001",
    name: "Sprigatito",
    category: "Pokemon",
    stage: "Basic",
    rarity: "Common",
  },
  exPokemon: {
    id: "sv01-019",
    localId: "019",
    name: "Arcanine ex",
    category: "Pokemon",
    stage: "Stage1",
    rarity: "Double Rare",
    suffix: "ex",
  },
  vPokemon: {
    id: "cel25-16",
    localId: "16",
    name: "Zacian V",
    category: "Pokemon",
    stage: "Basic",
    rarity: "Ultra Rare",
  },
  vmaxPokemon: {
    id: "cel25-7",
    localId: "7",
    name: "Flygon VMAX",
    category: "Pokemon",
    stage: "VMAX",
    rarity: "Rare VMAX",
  },
  vstarPokemon: {
    id: "swsh12.5-019",
    localId: "019",
    name: "Leafeon VSTAR",
    category: "Pokemon",
    stage: "VSTAR",
    rarity: "Rare VSTAR",
  },
  illustrationRare: {
    id: "sv01-207",
    localId: "207",
    name: "Oinkologne",
    category: "Pokemon",
    rarity: "Illustration Rare",
    set: { id: "sv01", name: "Scarlet & Violet", cardCount: { official: 198 } },
  },
  trainerItem: {
    id: "sv01-172",
    localId: "172",
    name: "Rare Candy",
    category: "Trainer",
    trainerType: "Item",
    rarity: "Uncommon",
  },
  trainerSupporter: {
    id: "sv01-175",
    localId: "175",
    name: "Jacq",
    category: "Trainer",
    trainerType: "Supporter",
    rarity: "Uncommon",
  },
  trainerStadium: {
    id: "sv03-196",
    localId: "196",
    name: "Artazon",
    category: "Trainer",
    trainerType: "Stadium",
    rarity: "Uncommon",
  },
  energyBasic: {
    id: "sv06.5-098",
    localId: "098",
    name: "Basic Darkness Energy",
    category: "Energy",
    energyType: "Normal",
    rarity: "Common",
  },
  energySpecial: {
    id: "sv01-191",
    localId: "191",
    name: "Luminous Energy",
    category: "Energy",
    energyType: "Special",
    rarity: "Uncommon",
  },
};

describe("prompt-db rules", () => {
  test("prints prompt for each card type", () => {
    console.log("\n--- Prompt for each card type ---\n");
    for (const [label, card] of Object.entries(CARDS)) {
      const result = getPromptForCard(card);
      console.log(
        `${label.padEnd(22)} rule=${result.ruleName.padEnd(20)} skip=${String(result.skip).padEnd(5)} prompt=${result.prompt ?? "(none)"}`,
      );
      // Every card should match some rule
      expect(result.ruleName).not.toBe("no-match");
    }
  });

  test("standard pokemon gets a prompt", () => {
    const result = getPromptForCard(CARDS.standardPokemon);
    expect(result.ruleName).toBe("standard-pokemon");
    expect(result.skip).toBe(false);
    expect(result.prompt).toBeString();
  });

  test("basic energy is skipped", () => {
    const basic = getPromptForCard(CARDS.energyBasic);
    expect(basic.ruleName).toBe("energy-basic");
    expect(basic.skip).toBe(true);
    expect(basic.prompt).toBeNull();
  });

  test("special energy gets a prompt", () => {
    const special = getPromptForCard(CARDS.energySpecial);
    expect(special.ruleName).toBe("energy-special");
    expect(special.skip).toBe(false);
    expect(special.prompt).toBeString();
  });

  test("trainer cards get trainer rule", () => {
    const result = getPromptForCard(CARDS.trainerItem);
    expect(result.ruleName).toBe("trainer");
    expect(result.skip).toBe(false);
    expect(result.prompt).toBeString();
  });

  test("fullart ex gets fullart-ex rule", () => {
    const result = getPromptForCard(CARDS.exPokemon);
    expect(result.ruleName).toBe("fullart-ex");
    expect(result.skip).toBe(false);
  });

  test("VMAX gets fullart-vmax rule", () => {
    const result = getPromptForCard(CARDS.vmaxPokemon);
    expect(result.ruleName).toBe("fullart-vmax");
  });

  test("VSTAR gets fullart-vstar rule", () => {
    const result = getPromptForCard(CARDS.vstarPokemon);
    expect(result.ruleName).toBe("fullart-vstar");
  });
});

describe("card-specific override", () => {
  const OVERRIDE_CARD_ID = "sv01-001";
  const OVERRIDE_PROMPT = "TEST OVERRIDE: custom prompt for this specific card";

  test("saving an override makes it take priority", () => {
    // Before override, should match the generic rule
    const before = getPromptForCard(CARDS.standardPokemon);
    expect(before.ruleName).toBe("standard-pokemon");

    // Save a card-specific override
    saveCardPrompt(OVERRIDE_CARD_ID, OVERRIDE_PROMPT);

    // Now should match the card-specific rule
    const after = getPromptForCard(CARDS.standardPokemon);
    expect(after.ruleName).toBe(`card:${OVERRIDE_CARD_ID}`);
    expect(after.prompt).toBe(OVERRIDE_PROMPT);
    expect(after.skip).toBe(false);

    console.log("\n--- After override ---");
    console.log(`  rule=${after.ruleName}  prompt=${after.prompt}`);
  });

  test("override does not affect other cards", () => {
    const other = getPromptForCard(CARDS.exPokemon);
    expect(other.ruleName).not.toStartWith("card:");
  });
});

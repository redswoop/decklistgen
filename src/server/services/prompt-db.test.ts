import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs";
import { join } from "node:path";

const CARD_PROMPTS_PATH = join(import.meta.dir, "../../../data/card-prompts.json");
const CARD_PROMPTS_BACKUP = CARD_PROMPTS_PATH + ".bak";

let getPromptForCard: typeof import("./prompt-db.js").getPromptForCard;
let saveCardPrompt: typeof import("./prompt-db.js").saveCardPrompt;
let EXPAND_PROMPT: string;

beforeAll(async () => {
  if (existsSync(CARD_PROMPTS_PATH)) {
    copyFileSync(CARD_PROMPTS_PATH, CARD_PROMPTS_BACKUP);
  }
  const mod = await import("./prompt-db.js");
  getPromptForCard = mod.getPromptForCard;
  saveCardPrompt = mod.saveCardPrompt;
  EXPAND_PROMPT = mod.EXPAND_PROMPT;
});

afterAll(() => {
  if (existsSync(CARD_PROMPTS_BACKUP)) {
    copyFileSync(CARD_PROMPTS_BACKUP, CARD_PROMPTS_PATH);
  }
});

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
  vmaxPokemon: {
    id: "cel25-7",
    localId: "7",
    name: "Flygon VMAX",
    category: "Pokemon",
    stage: "VMAX",
    rarity: "Rare VMAX",
  },
  trainerItem: {
    id: "sv01-172",
    localId: "172",
    name: "Rare Candy",
    category: "Trainer",
    trainerType: "Item",
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

describe("prompt-db", () => {
  test("all cards get expand prompt", () => {
    for (const [label, card] of Object.entries(CARDS)) {
      const result = getPromptForCard(card);
      expect(result.skip).toBe(false);
      expect(result.prompt).toBe(EXPAND_PROMPT);
      console.log(`${label.padEnd(20)} rule=${result.ruleName}`);
    }
  });

  test("basic energy gets expand prompt", () => {
    const result = getPromptForCard(CARDS.energyBasic);
    expect(result.ruleName).toBe("default");
    expect(result.skip).toBe(false);
    expect(result.prompt).toBe(EXPAND_PROMPT);
  });

  test("special energy gets expand prompt", () => {
    const result = getPromptForCard(CARDS.energySpecial);
    expect(result.skip).toBe(false);
    expect(result.prompt).toBe(EXPAND_PROMPT);
  });

  test("standard pokemon gets expand prompt", () => {
    const result = getPromptForCard(CARDS.standardPokemon);
    expect(result.ruleName).toBe("default");
    expect(result.prompt).toBe(EXPAND_PROMPT);
  });

  test("fullart pokemon gets expand prompt", () => {
    const result = getPromptForCard(CARDS.exPokemon);
    expect(result.ruleName).toBe("default");
    expect(result.prompt).toBe(EXPAND_PROMPT);
  });

  test("trainer gets expand prompt", () => {
    const result = getPromptForCard(CARDS.trainerItem);
    expect(result.ruleName).toBe("default");
    expect(result.prompt).toBe(EXPAND_PROMPT);
  });
});

describe("card-specific override", () => {
  const OVERRIDE_CARD_ID = "sv01-001";
  const OVERRIDE_PROMPT = "TEST OVERRIDE: custom prompt for this specific card";

  test("saving an override makes it take priority", () => {
    const before = getPromptForCard(CARDS.standardPokemon);
    expect(before.ruleName).toBe("default");

    saveCardPrompt(OVERRIDE_CARD_ID, OVERRIDE_PROMPT);

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

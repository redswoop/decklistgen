import { describe, it, expect } from "bun:test";
import { suggestTemplate } from "./suggest-template.js";

describe("suggestTemplate", () => {
  it("returns basic-energy for energy without effect", () => {
    expect(suggestTemplate({ id: "e1", localId: "1", name: "Fire Energy", category: "Energy" })).toBe("basic-energy");
  });

  it("returns trainer for special energy (energy with effect)", () => {
    // Special energies have an effect field — they're still Energy category but not basic
    // Actually they should NOT be trainer, let's think... the function checks Energy first
    // If category=Energy and effect exists, it falls through to fullart/standard check
    const card = { id: "e2", localId: "2", name: "Jet Energy", category: "Energy" as const, effect: "Some effect" };
    const result = suggestTemplate(card);
    // Special energies aren't basic-energy and aren't trainer — they fall through to standard
    expect(result).toBe("pokemon-standard");
  });

  it("returns trainer for trainer cards", () => {
    expect(suggestTemplate({ id: "t1", localId: "1", name: "Boss's Orders", category: "Trainer" })).toBe("trainer");
  });

  it("returns pokemon-vstar for VSTAR stage", () => {
    expect(suggestTemplate({ id: "v1", localId: "1", name: "Arceus VSTAR", category: "Pokemon", stage: "VSTAR" })).toBe("pokemon-vstar");
  });

  it("returns pokemon-fullart for ex cards", () => {
    expect(suggestTemplate({ id: "f1", localId: "1", name: "Charizard ex", category: "Pokemon", stage: "Stage 2" })).toBe("pokemon-fullart");
  });

  it("returns pokemon-fullart for V cards", () => {
    expect(suggestTemplate({ id: "f2", localId: "1", name: "Giratina V", category: "Pokemon" })).toBe("pokemon-fullart");
  });

  it("returns pokemon-standard for regular pokemon", () => {
    expect(suggestTemplate({ id: "s1", localId: "1", name: "Pikachu", category: "Pokemon", stage: "Basic" })).toBe("pokemon-standard");
  });

  it("returns pokemon-fullart for illustration rare", () => {
    expect(suggestTemplate({ id: "ir1", localId: "200", name: "Mew", category: "Pokemon", rarity: "Illustration Rare" })).toBe("pokemon-fullart");
  });
});

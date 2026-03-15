import { describe, test, expect } from "bun:test";
import { enrichCardData } from "./enrich-card-data.js";

describe("enrichCardData", () => {
  test("splits _stageName from stage field", () => {
    const data = enrichCardData({ name: "Charizard", stage: "Stage2" });
    expect(data._stageName).toBe("Stage 2");
  });

  test("normalizes Stage1 to Stage 1", () => {
    const data = enrichCardData({ name: "Charmeleon", stage: "Stage1" });
    expect(data._stageName).toBe("Stage 1");
  });

  test("passes through non-StageN stage names unchanged", () => {
    const data = enrichCardData({ name: "Leafeon VSTAR", stage: "VSTAR" });
    expect(data._stageName).toBe("VSTAR");
  });

  test("defaults _stageName to Basic when no stage", () => {
    const data = enrichCardData({ name: "Sprigatito" });
    expect(data._stageName).toBe("Basic");
  });

  test("computes _evolvesFrom when evolveFrom is set", () => {
    const data = enrichCardData({ name: "Charizard", evolveFrom: "Charmeleon" });
    expect(data._evolvesFrom).toBe("Evolves from Charmeleon");
  });

  test("_evolvesFrom is empty when no evolveFrom", () => {
    const data = enrichCardData({ name: "Sprigatito" });
    expect(data._evolvesFrom).toBe("");
  });

  test("extracts _subtitle from parenthetical in name", () => {
    const data = enrichCardData({
      name: "Professor's Research (Professor Sada)",
      category: "Trainer",
      trainerType: "Supporter",
    });
    expect(data._subtitle).toBe("Professor Sada");
    expect(data._baseName).toBe("Professor's Research");
  });

  test("_subtitle is empty for names without parenthetical", () => {
    const data = enrichCardData({ name: "Rare Candy", category: "Trainer" });
    expect(data._subtitle).toBe("");
    expect(data._baseName).toBe("Rare Candy");
  });

  test("_baseName strips parenthetical before suffix splitting", () => {
    const data = enrichCardData({
      name: "Boss's Orders (Ghetsis)",
      category: "Trainer",
      trainerType: "Supporter",
    });
    expect(data._subtitle).toBe("Ghetsis");
    expect(data._baseName).toBe("Boss's Orders");
  });

  test("does not produce _stageLabel (removed field)", () => {
    const data = enrichCardData({ name: "Charizard", stage: "Stage2", evolveFrom: "Charmeleon" });
    expect(data._stageLabel).toBeUndefined();
  });
});

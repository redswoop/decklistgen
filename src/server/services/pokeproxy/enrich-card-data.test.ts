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

  test("defaults to light text mode when _textMode not set", () => {
    const data = enrichCardData({ name: "Charizard" });
    expect(data._textFill).toBe("#ffffff");
    expect(data._textStroke).toBe("#000000");
    expect(data._subtleFill).toBe("#ffffff");
    expect(data._palette).toBe("light");
    expect(data._contentFill).toBe("#000000");
    expect(data._contentOpacity).toBe(0.15);
  });

  test("light text mode produces white text on dark bg", () => {
    const data = enrichCardData({ name: "Charizard", _textMode: "light" });
    expect(data._textFill).toBe("#ffffff");
    expect(data._textStroke).toBe("#000000");
    expect(data._textStrokeWidth).toBe(2.5);
    expect(data._subtleFill).toBe("#ffffff");
    expect(data._palette).toBe("light");
    expect(data._contentFill).toBe("#000000");
    expect(data._contentOpacity).toBe(0.15);
  });

  test("dark text mode produces dark text on bright bg", () => {
    const data = enrichCardData({ name: "Iono", _textMode: "dark" });
    expect(data._textFill).toBe("#222222");
    expect(data._textStroke).toBe("#ffffff");
    expect(data._textStrokeWidth).toBe(2.5);
    expect(data._subtleFill).toBe("#333333");
    expect(data._palette).toBe("dark");
    expect(data._contentFill).toBe("#ffffff");
    expect(data._contentOpacity).toBe(0.12);
  });

  test("_ribbonColor set from primary energy type", () => {
    const data = enrichCardData({ name: "Charizard", types: ["Fire"] });
    expect(data._ribbonColor).toBe("#D4301A");
  });

  test("_ribbonColor uses first type when multiple types", () => {
    const data = enrichCardData({ name: "Rayquaza", types: ["Dragon", "Colorless"] });
    expect(data._ribbonColor).toBe("#5B2DA0");
  });

  test("_ribbonColor is empty when no types", () => {
    const data = enrichCardData({ name: "Rare Candy", category: "Trainer" });
    expect(data._ribbonColor).toBe("");
  });
});

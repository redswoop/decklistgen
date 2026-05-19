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

  test("_ribbonColor is empty when no types and no recognised trainerType", () => {
    const data = enrichCardData({ name: "Rare Candy", category: "Trainer" });
    expect(data._ribbonColor).toBe("");
  });

  test("_ribbonColor falls back to trainer-type color for Tool trainers", () => {
    const data = enrichCardData({ name: "Technical Machine: Evolution", category: "Trainer", trainerType: "Tool" });
    expect(data._ribbonColor).toBe("#7C3AA8");
  });

  test("_effectFull holds the effect for ordinary trainers; _effectCompact stays empty", () => {
    const effect = "Each player shuffles their hand and puts it on the bottom of their deck.";
    const data = enrichCardData({ name: "Iono", category: "Trainer", trainerType: "Supporter", effect });
    expect(data._effectFull).toBe(effect);
    expect(data._effectCompact).toBe("");
  });

  test("Technical Machine preamble switches to compact slot; _effectFull cleared", () => {
    const tmPreamble = "The Pokémon this card is attached to can use the attack on this card. (You still need the necessary Energy to use this attack.) If this card is attached to 1 of your Pokémon, discard it at the end of your turn.";
    const data = enrichCardData({
      name: "Technical Machine: Evolution",
      category: "Trainer",
      trainerType: "Tool",
      effect: tmPreamble,
      attacks: [{ cost: ["Colorless"], name: "Evolution", effect: "…" }],
    });
    expect(data._effectCompact).toBe("Use this attack from attached Pokémon. Discard after use.");
    expect(data._effectFull).toBe("");
  });

  test("both effect fields empty when no effect set", () => {
    const data = enrichCardData({ name: "Charizard" });
    expect(data._effectCompact).toBe("");
    expect(data._effectFull).toBe("");
  });

  test("_hpTextFill defaults to global text mode when _hpTextMode absent", () => {
    const dark = enrichCardData({ name: "Iono", _textMode: "dark" });
    expect(dark._hpTextFill).toBe("#222222");
    expect(dark._hpTextStroke).toBe("#ffffff");

    const light = enrichCardData({ name: "Charizard", _textMode: "light" });
    expect(light._hpTextFill).toBe("#ffffff");
    expect(light._hpTextStroke).toBe("#000000");
  });

  test("_hpTextFill overrides global mode when _hpTextMode set differently", () => {
    // Card overall is dark text (bright bg), but HP corner is dark — flip HP to light text
    const data = enrichCardData({ name: "X", _textMode: "dark", _hpTextMode: "light" });
    expect(data._hpTextFill).toBe("#ffffff");
    expect(data._hpTextStroke).toBe("#000000");
    // Confirm the global decision was preserved for non-HP elements
    expect(data._textFill).toBe("#222222");
  });

  test("_trainerGradient set per trainer type", () => {
    expect(enrichCardData({ name: "Potion", category: "Trainer", trainerType: "Item" })._trainerGradient).toBe("metallic-trainer-item");
    expect(enrichCardData({ name: "Iono", category: "Trainer", trainerType: "Supporter" })._trainerGradient).toBe("metallic-trainer-supporter");
    expect(enrichCardData({ name: "Path", category: "Trainer", trainerType: "Stadium" })._trainerGradient).toBe("metallic-trainer-stadium");
    expect(enrichCardData({ name: "Scarf", category: "Trainer", trainerType: "Tool" })._trainerGradient).toBe("metallic-trainer-tool");
  });

  test("_trainerGradient falls back to default for unknown trainer type", () => {
    const data = enrichCardData({ name: "?", category: "Trainer", trainerType: "Mystery" });
    expect(data._trainerGradient).toBe("metallic-trainer-default");
  });

  test("_trainerGradient uses Special Energy gradient when category=Energy and has effect", () => {
    // enrichCardData synthesizes trainerType=Special Energy in this case
    const data = enrichCardData({ name: "Capture Energy", category: "Energy", effect: "Search for a Basic Pokemon..." });
    expect(data.trainerType).toBe("Special Energy");
    expect(data._trainerGradient).toBe("metallic-trainer-special-energy");
  });

  test("_trainerTypeColor matches the official type color", () => {
    expect(enrichCardData({ name: "Path", category: "Trainer", trainerType: "Stadium" })._trainerTypeColor).toBe("#3B9B2F");
    expect(enrichCardData({ name: "Iono", category: "Trainer", trainerType: "Supporter" })._trainerTypeColor).toBe("#D44820");
  });

  test("_trainerTypeColorLight is a brighter shade for label legibility", () => {
    expect(enrichCardData({ name: "Path", category: "Trainer", trainerType: "Stadium" })._trainerTypeColorLight).toBe("#B8E6A0");
    expect(enrichCardData({ name: "Iono", category: "Trainer", trainerType: "Supporter" })._trainerTypeColorLight).toBe("#FFC8A8");
    expect(enrichCardData({ name: "Potion", category: "Trainer", trainerType: "Item" })._trainerTypeColorLight).toBe("#A8D4FF");
    expect(enrichCardData({ name: "Scarf", category: "Trainer", trainerType: "Tool" })._trainerTypeColorLight).toBe("#D8B0F0");
  });

  test("_trainerGradient not set for Pokemon", () => {
    const data = enrichCardData({ name: "Pikachu", category: "Pokemon" });
    expect(data._trainerGradient).toBeUndefined();
  });
});

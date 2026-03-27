/**
 * Card data enrichment — adds computed fields needed by JSON templates.
 * Extracted from editor.ts /card-data endpoint for reuse by the
 * JSON template renderer and the editor API.
 */

import { splitNameSuffix, splitNameSubtitle } from "./svg-helpers.js";
import { getPokemonSuffix } from "./text.js";
import { POKEMON_RULES, TRAINER_RULES, TYPE_MATCHUPS, TYPE_COLORS } from "./constants.js";

/** Enrich raw card data with computed fields for template rendering. Mutates and returns `data`. */
export function enrichCardData(data: Record<string, unknown>): Record<string, unknown> {
  const name = (data.name as string) ?? "";

  // Name subtitle — extract parenthetical: "Professor's Research (Professor Sada)" → subtitle "Professor Sada"
  // Apply BEFORE suffix splitting so _baseName is also clean
  const [nameNoSub, subtitle] = splitNameSubtitle(name);
  data._subtitle = subtitle;

  // Suffix splitting now uses the parenthetical-free name
  const [baseName, nameSuffix] = splitNameSuffix(nameNoSub, data);
  data._baseName = baseName;
  data._nameSuffix = nameSuffix;

  // Rule text
  const category = (data.category as string) ?? "Pokemon";
  const suffix = getPokemonSuffix(data);
  const trainerType = (data.trainerType as string) ?? "";
  // Special energy cards use the trainer template — set trainerType for the badge
  if (category === "Energy" && data.effect && !trainerType) {
    data.trainerType = "Special Energy";
  }

  let ruleText = "";
  if (category === "Pokemon" && suffix in POKEMON_RULES) ruleText = POKEMON_RULES[suffix];
  else if ((category === "Trainer" || category === "Energy") && (data.trainerType as string) in TRAINER_RULES)
    ruleText = TRAINER_RULES[data.trainerType as string];
  data._ruleText = ruleText;

  // Stage — normalize "Stage1" → "Stage 1" for display
  const rawStage = (data.stage as string) ?? "Basic";
  data._stageName = rawStage.replace(/^(Stage)(\d)$/i, "$1 $2");

  // Evolution subtitle
  const evolveFrom = (data.evolveFrom as string) ?? "";
  data._evolvesFrom = evolveFrom ? `Evolves from ${evolveFrom}` : "";

  // Footer
  const setObj = data.set as Record<string, unknown> | undefined;
  const setName = (setObj?.name as string) ?? "";
  const localId = (data.localId as string) ?? "";
  data._footer = setName && localId ? `${setName} • ${localId}` : setName || localId;

  // Retreat cost as array of "Colorless" strings for repeater binding
  const retreat = (data.retreat as number) ?? 0;
  data._retreatDots = Array.from({ length: retreat }, () => "Colorless");

  // Big logo suffix (for VSTAR cards)
  const bigLogoSuffix = suffix === "VSTAR" ? "VSTAR-big" : undefined;
  if (bigLogoSuffix) data._bigLogoSuffix = bigLogoSuffix;

  // Adaptive text mode — default "light" (white text for dark backgrounds)
  const textMode = (data._textMode as string) ?? "light";
  if (textMode === "dark") {
    data._textFill = "#222222";
    data._textStroke = "#ffffff";
    data._textStrokeWidth = 2.5;
    data._subtleFill = "#333333";
    data._palette = "dark";
    data._contentFill = "#ffffff";
    data._contentOpacity = 0.12;
  } else {
    data._textFill = "#ffffff";
    data._textStroke = "#000000";
    data._textStrokeWidth = 2.5;
    data._subtleFill = "#ffffff";
    data._palette = "light";
    data._contentFill = "#000000";
    data._contentOpacity = 0.15;
  }

  // Ribbon color from primary energy type
  const primaryType = ((data.types as string[]) ?? [])[0] ?? "";
  data._ribbonColor = TYPE_COLORS[primaryType] ?? "";

  // Energy label for basic energy badge (e.g. "Fire Energy")
  if (category === "Energy" && !data.effect) {
    data._energyLabel = primaryType ? `${primaryType} Energy` : "Basic Energy";
  }

  // Auto-compute weaknesses/resistances from TYPE_MATCHUPS if not present
  if (category !== "Trainer" && category !== "Energy") {
    const cardType = primaryType;
    if (!data.weaknesses && cardType in TYPE_MATCHUPS) {
      const [wt, wv] = TYPE_MATCHUPS[cardType];
      if (wt) data.weaknesses = [{ type: wt, value: wv! }];
    }
    if (!data.resistances && cardType in TYPE_MATCHUPS) {
      const [, , rt, rv] = TYPE_MATCHUPS[cardType];
      if (rt) data.resistances = [{ type: rt, value: rv! }];
    }
  }

  return data;
}

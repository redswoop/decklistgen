/**
 * Card data preparation: raw card JSON → normalized CardProps.
 * Extracts data parsing and layout solving from renderer.ts.
 */

import { CARD_W, CARD_H, TYPE_COLORS, MARGIN } from "./constants.js";
import { compressText } from "./compress.js";
import { getPokemonSuffix, ftContentHeight } from "./text.js";
import { escapeXml, splitNameSuffix, splitNameSubtitle } from "./svg-helpers.js";
import type { CardProps, SolvedLayout } from "./templates/types.js";

export function prepareCardProps(
  card: Record<string, unknown>,
  imageB64: string,
  layout: SolvedLayout,
): CardProps {
  const rawName = (card.name as string) ?? "Unknown";
  const name = escapeXml(rawName);
  const hp = card.hp as number | undefined;
  const types = (card.types as string[]) ?? [];
  const cardType = types[0] ?? "Colorless";
  let color = TYPE_COLORS[cardType] ?? "#888888";
  const retreat = (card.retreat as number) ?? 0;
  const setName = ((card.set as Record<string, unknown>)?.name as string) ?? "";
  const localId = (card.localId as string) ?? "";
  const category = (card.category as string) ?? "Pokemon";
  const trainerType = (card.trainerType as string) ?? "";
  const trainerEffect = compressText((card.effect as string) ?? "");
  const stage = (card.stage as string) ?? "Basic";
  const evolveFrom = (card.evolveFrom as string) ?? "";

  const abilities = ((card.abilities as Array<Record<string, unknown>>) ?? []).map(ab => ({
    type: (ab.type as string) ?? "Ability",
    name: (ab.name as string) ?? "",
    effect: compressText((ab.effect as string) ?? ""),
  }));
  const attacks = ((card.attacks as Array<Record<string, unknown>>) ?? []).map(atk => ({
    name: (atk.name as string) ?? "",
    damage: String((atk.damage as string | number) ?? ""),
    cost: (atk.cost as string[]) ?? [],
    effect: compressText((atk.effect as string) ?? ""),
  }));

  if (category === "Trainer") {
    if (trainerType === "Supporter") color = "#C04010";
    else if (trainerType === "Stadium") color = "#1A7A3A";
    else color = "#1860A0";
  }

  const suffix = getPokemonSuffix(card);
  const [baseName, nameSuffix] = splitNameSuffix(rawName, card);
  const [mainName, subtitle] = splitNameSubtitle(rawName);

  return {
    name, rawName, baseName, nameSuffix, mainName, subtitle, suffix,
    hp, types, cardType, color, category, trainerType,
    stage, evolveFrom, retreat, setName, localId,
    trainerEffect, abilities, attacks,
    layout, imageB64, card,
  };
}

// ─── Layout solvers ───

const HEAD_RATIO = 28 / 24;

function measureContent(
  bodySize: number,
  textMaxW: number,
  category: string,
  trainerEffect: string,
  abilities: Array<Record<string, unknown>>,
  attacks: Array<Record<string, unknown>>,
  card: Record<string, unknown>,
): number {
  return ftContentHeight(
    bodySize, Math.floor(bodySize * HEAD_RATIO),
    textMaxW, category, trainerEffect, abilities, attacks, card,
  );
}

export function solveStandardLayout(
  card: Record<string, unknown>,
  artY: number,
  opts?: { fontSize?: number },
): SolvedLayout {
  const category = (card.category as string) ?? "Pokemon";
  const trainerEffect = compressText((card.effect as string) ?? "");
  const abilities = ((card.abilities as Array<Record<string, unknown>>) ?? []).map(ab => ({
    ...ab, effect: compressText((ab.effect as string) ?? ""),
  }));
  const attacks = ((card.attacks as Array<Record<string, unknown>>) ?? []).map(atk => ({
    ...atk, effect: compressText((atk.effect as string) ?? ""),
  }));

  const textMaxW = CARD_W - 2 * MARGIN;
  const ART_H_MAX = Math.floor((CARD_W - 40) / 1.59);
  const ART_H_MIN = 200;
  const ART_PAD = 40;
  const contentBottom = CARD_H - 90;
  const BODY_LARGE = 40, BODY_MEDIUM = 34, BODY_SMALL = 28;
  const ART_PREFER = 300;

  const hasText = !!((category === "Trainer" || category === "Energy") && trainerEffect) || abilities.length > 0 || attacks.length > 0;

  function _measure(body: number): number {
    return measureContent(body, textMaxW, category, trainerEffect, abilities, attacks, card);
  }

  const space = contentBottom - artY - ART_PAD;

  function _bestInRange(loBody: number, hiBody: number): [number, number, number] {
    let lo = loBody, hi = hiBody;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      if (_measure(Math.floor(mid)) <= space - ART_PREFER) lo = mid;
      else hi = mid;
    }
    const size = Math.floor(lo);
    const th = _measure(size);
    return [size, th, Math.max(ART_H_MIN, Math.min(ART_H_MAX, space - th))];
  }

  let bodySize: number;
  let artHeight: number;

  if (opts?.fontSize != null) {
    // Font size override: use the specified size, compute art height from remaining space
    bodySize = opts.fontSize;
    if (hasText) {
      const th = _measure(bodySize);
      artHeight = Math.max(ART_H_MIN, Math.min(ART_H_MAX, space - th));
    } else {
      artHeight = ART_H_MAX;
    }
  } else if (hasText) {
    const textHLarge = _measure(BODY_LARGE);

    if (textHLarge <= space - ART_H_MAX) {
      bodySize = BODY_LARGE;
      artHeight = Math.min(ART_H_MAX, space - textHLarge);
    } else if (textHLarge <= space - ART_PREFER) {
      [bodySize, , artHeight] = _bestInRange(BODY_MEDIUM, BODY_LARGE);
    } else if (_measure(BODY_MEDIUM) <= space - ART_PREFER) {
      [bodySize, , artHeight] = _bestInRange(BODY_MEDIUM, BODY_LARGE);
    } else if (_measure(BODY_SMALL) <= space - ART_PREFER) {
      [bodySize, , artHeight] = _bestInRange(BODY_SMALL, BODY_MEDIUM);
    } else if (_measure(BODY_SMALL) <= space - ART_H_MIN) {
      bodySize = BODY_SMALL;
      const th = _measure(bodySize);
      artHeight = Math.max(ART_H_MIN, Math.min(ART_H_MAX, space - th));
    } else {
      bodySize = BODY_SMALL;
      const th = _measure(bodySize);
      artHeight = Math.max(ART_H_MIN, space - th);
    }
  } else {
    artHeight = ART_H_MAX;
    bodySize = BODY_LARGE;
  }

  return {
    bodySize,
    headSize: Math.floor(bodySize * HEAD_RATIO),
    lineH: Math.floor(bodySize * 1.25),
    artHeight,
    artY,
  };
}

export function solveFullartLayout(
  card: Record<string, unknown>,
  opts: { maxCover?: number; fontSize?: number } = {},
): SolvedLayout {
  const { maxCover = 0.55, fontSize: fontSizeOpt } = opts;

  const category = (card.category as string) ?? "Pokemon";
  const trainerEffect = compressText((card.effect as string) ?? "");
  const abilities = ((card.abilities as Array<Record<string, unknown>>) ?? []).map(ab => ({
    ...ab, effect: compressText((ab.effect as string) ?? ""),
  }));
  const attacks = ((card.attacks as Array<Record<string, unknown>>) ?? []).map(atk => ({
    ...atk, effect: compressText((atk.effect as string) ?? ""),
  }));

  const textMaxW = CARD_W - 2 * MARGIN;
  const hasText = !!((category === "Trainer" || category === "Energy") && trainerEffect) || abilities.length > 0 || attacks.length > 0;

  const textPad = 50;
  const footerH = 80;
  const halfCard = Math.floor(CARD_H * 0.50);
  const BODY_LARGE = 36, BODY_MEDIUM = 30;

  let bodySize: number;
  let overlayTop: number;

  if (fontSizeOpt != null) {
    bodySize = fontSizeOpt;
    if (hasText) {
      const headCandidate = Math.floor(bodySize * HEAD_RATIO);
      const textH = ftContentHeight(bodySize, headCandidate, textMaxW, category, trainerEffect, abilities, attacks, card);
      overlayTop = CARD_H - (textH + textPad + footerH) - 40;
    } else {
      overlayTop = CARD_H - footerH - 40;
    }
  } else if (hasText) {
    let textH!: number;
    let bodyCandidate = BODY_LARGE;
    for (const bc of [BODY_LARGE, BODY_MEDIUM]) {
      bodyCandidate = bc;
      const headCandidate = Math.floor(bc * HEAD_RATIO);
      textH = ftContentHeight(bc, headCandidate, textMaxW, category, trainerEffect, abilities, attacks, card);
      const textBlockH = textH + textPad + footerH;
      overlayTop = CARD_H - textBlockH - 40;
      if (overlayTop! >= halfCard) break;
    }
    bodySize = bodyCandidate;
    // Recompute with final size
    const finalTextH = ftContentHeight(bodySize, Math.floor(bodySize * HEAD_RATIO), textMaxW, category, trainerEffect, abilities, attacks, card);
    const textBlockH = finalTextH + textPad + footerH;
    overlayTop = CARD_H - textBlockH - 40;
  } else {
    bodySize = BODY_LARGE;
    overlayTop = CARD_H - footerH - 40;
  }

  overlayTop = Math.max(overlayTop!, Math.floor(CARD_H * (1.0 - maxCover)));

  return {
    bodySize,
    headSize: Math.floor(bodySize * HEAD_RATIO),
    lineH: Math.floor(bodySize * 1.25),
    overlayTop,
  };
}

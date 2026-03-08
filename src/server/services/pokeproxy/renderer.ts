/**
 * PokeProxy SVG renderer — TypeScript port of pokeproxy.py.
 *
 * Three render modes:
 *   - generateSvg: standard cards (white bg, cropped artwork)
 *   - generateFullartSvg: full-art cards (full image bg, gradient overlay)
 *   - generateBasicEnergySvg: basic energy (full image, minimal overlay)
 */

import {
  CARD_W, CARD_H,
  TYPE_COLORS,
  FONT_TITLE, FONT_BODY, MARGIN,
  POKEMON_RULES, TRAINER_RULES,
  ART_TOP, ART_BOTTOM, ART_LEFT, ART_RIGHT,
} from "./constants.js";
import { compressText } from "./compress.js";
import { getFontStyle, renderTypeIcon, resetIconIds } from "./type-icons.js";
import {
  measureWidth, ftWrap, ftContentHeight, fitAttackHeader, fitNameSize,
  getPokemonSuffix,
} from "./text.js";

export { resetIconIds };

// ─── Helpers (re-exported from svg-helpers.ts) ───

import {
  escapeXml, splitNameSuffix, splitNameSubtitle,
  renderEnergyDots, energyInlineSvg, renderTextLineWithEnergy,
  renderFooterSvg, fitAbilityHeader,
} from "./svg-helpers.js";

// ─── Full-art renderer ───

export interface FullartOptions {
  overlayOpacity?: number;
  fontSize?: number;
  maxCover?: number;
  renderHeader?: boolean;
}

export function generateFullartSvg(
  card: Record<string, unknown>,
  imageB64: string,
  opts: FullartOptions = {},
): string {
  const {
    overlayOpacity = 0.7,
    fontSize: fontSizeOpt,
    maxCover = 0.55,
  } = opts;

  const rawName = (card.name as string) ?? "Unknown";
  const name = escapeXml(rawName);
  const hp = card.hp as number | undefined;
  const types = (card.types as string[]) ?? [];
  const cardType = types[0] ?? "Colorless";
  let color = TYPE_COLORS[cardType] ?? "#888888";
  const retreat = (card.retreat as number) ?? 0;
  let abilities = (card.abilities as Array<Record<string, unknown>>) ?? [];
  let attacks = (card.attacks as Array<Record<string, unknown>>) ?? [];
  const setName = ((card.set as Record<string, unknown>)?.name as string) ?? "";
  const localId = (card.localId as string) ?? "";
  const category = (card.category as string) ?? "Pokemon";
  const trainerType = (card.trainerType as string) ?? "";
  const trainerEffect = compressText((card.effect as string) ?? "");

  abilities = abilities.map(ab => ({ ...ab, effect: compressText((ab.effect as string) ?? "") }));
  attacks = attacks.map(atk => ({ ...atk, effect: compressText((atk.effect as string) ?? "") }));

  if (category === "Trainer") {
    if (trainerType === "Supporter") color = "#C04010";
    else if (trainerType === "Stadium") color = "#1A7A3A";
    else color = "#1860A0";
  }

  const suffix = getPokemonSuffix(card);
  const [baseName, nameSuffix] = splitNameSuffix(rawName, card);
  const [mainName, subtitle] = splitNameSubtitle(rawName);

  const textMaxW = CARD_W - 2 * MARGIN;
  const hasText = !!((category === "Trainer" || category === "Energy") && trainerEffect) || abilities.length > 0 || attacks.length > 0;

  const HEAD_RATIO = 28 / 24;
  const textPad = 50;
  const footerH = 80;
  const halfCard = Math.floor(CARD_H * 0.50);
  const BODY_LARGE = 36, BODY_MEDIUM = 30;

  let BODY_SIZE: number;
  let overlayTop: number;
  let textH: number;

  if (fontSizeOpt != null) {
    BODY_SIZE = fontSizeOpt;
    if (hasText) {
      const headCandidate = Math.floor(BODY_SIZE * HEAD_RATIO);
      textH = ftContentHeight(BODY_SIZE, headCandidate, textMaxW, category, trainerEffect, abilities, attacks, card);
      overlayTop = CARD_H - (textH + textPad + footerH) - 40;
    } else {
      textH = 0;
      overlayTop = CARD_H - footerH - 40;
    }
  } else if (hasText) {
    let bodyCandidate = BODY_LARGE;
    for (const bc of [BODY_LARGE, BODY_MEDIUM]) {
      bodyCandidate = bc;
      const headCandidate = Math.floor(bc * HEAD_RATIO);
      textH = ftContentHeight(bc, headCandidate, textMaxW, category, trainerEffect, abilities, attacks, card);
      const textBlockH = textH! + textPad + footerH;
      overlayTop = CARD_H - textBlockH - 40;
      if (overlayTop! >= halfCard) break;
    }
    BODY_SIZE = bodyCandidate;
    textH = textH!;
    overlayTop = overlayTop!;
  } else {
    textH = 0;
    BODY_SIZE = BODY_LARGE;
    overlayTop = CARD_H - footerH - 40;
  }

  const HEAD_SIZE = Math.floor(BODY_SIZE * HEAD_RATIO);
  const LINE_H = Math.floor(BODY_SIZE * 1.25);

  if (hasText) {
    const textBlockH = textH + textPad + footerH;
    overlayTop = CARD_H - textBlockH - 40;
  }
  overlayTop = Math.max(overlayTop, Math.floor(CARD_H * (1.0 - maxCover)));

  const headerH = 100;
  const lines: string[] = [];

  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${CARD_W} ${CARD_H}" width="${CARD_W}" height="${CARD_H}">`);
  lines.push("  <defs>");
  lines.push(`    ${getFontStyle()}`);
  // Overlay gradient
  lines.push('    <linearGradient id="overlay-grad" x1="0" y1="0" x2="0" y2="1">');
  lines.push('      <stop offset="0%" stop-color="#000" stop-opacity="0"/>');
  lines.push(`      <stop offset="12%" stop-color="#000" stop-opacity="${(overlayOpacity * 0.5).toFixed(2)}"/>`);
  lines.push(`      <stop offset="35%" stop-color="#000" stop-opacity="${(overlayOpacity * 0.82).toFixed(2)}"/>`);
  lines.push(`      <stop offset="100%" stop-color="#000" stop-opacity="${overlayOpacity.toFixed(2)}"/>`);
  lines.push('    </linearGradient>');
  // Header gradient
  lines.push('    <linearGradient id="header-grad" x1="0" y1="0" x2="0" y2="1">');
  lines.push('      <stop offset="0%" stop-color="#000" stop-opacity="0.75"/>');
  lines.push('      <stop offset="70%" stop-color="#000" stop-opacity="0.4"/>');
  lines.push('      <stop offset="100%" stop-color="#000" stop-opacity="0"/>');
  lines.push('    </linearGradient>');
  // Suffix gradients
  lines.push('    <linearGradient id="grad-ex" x1="0" y1="0" x2="0" y2="1">');
  lines.push('      <stop offset="0%" stop-color="#FF3333"/>');
  lines.push('      <stop offset="50%" stop-color="#CC0000"/>');
  lines.push('      <stop offset="100%" stop-color="#990000"/>');
  lines.push('    </linearGradient>');
  lines.push('    <linearGradient id="grad-V" x1="0" y1="0" x2="0" y2="1">');
  lines.push('      <stop offset="0%" stop-color="#E8E8F0"/>');
  lines.push('      <stop offset="30%" stop-color="#B0B8C8"/>');
  lines.push('      <stop offset="70%" stop-color="#8890A0"/>');
  lines.push('      <stop offset="100%" stop-color="#C0C8D8"/>');
  lines.push('    </linearGradient>');
  lines.push('    <linearGradient id="grad-VMAX" x1="0" y1="0" x2="1" y2="1">');
  lines.push('      <stop offset="0%" stop-color="#FF6688"/>');
  lines.push('      <stop offset="25%" stop-color="#FFAA33"/>');
  lines.push('      <stop offset="50%" stop-color="#44DDFF"/>');
  lines.push('      <stop offset="75%" stop-color="#88FF66"/>');
  lines.push('      <stop offset="100%" stop-color="#DD88FF"/>');
  lines.push('    </linearGradient>');
  lines.push('    <linearGradient id="grad-VSTAR" x1="0" y1="0" x2="0" y2="1">');
  lines.push('      <stop offset="0%" stop-color="#FFE666"/>');
  lines.push('      <stop offset="35%" stop-color="#FFD700"/>');
  lines.push('      <stop offset="65%" stop-color="#DAA520"/>');
  lines.push('      <stop offset="100%" stop-color="#FFE066"/>');
  lines.push('    </linearGradient>');
  // Filters
  lines.push('    <filter id="shadow" x="-2%" y="-2%" width="104%" height="104%">');
  lines.push('      <feDropShadow dx="1" dy="1" stdDeviation="1.5" flood-color="#000" flood-opacity="0.7"/>');
  lines.push("    </filter>");
  lines.push('    <filter id="title-shadow" x="-3%" y="-8%" width="106%" height="116%">');
  lines.push('      <feDropShadow dx="1.5" dy="2" stdDeviation="1.5" flood-color="#000" flood-opacity="0.8"/>');
  lines.push('    </filter>');
  lines.push('    <filter id="suffix-emboss" x="-8%" y="-15%" width="116%" height="130%">');
  lines.push('      <feDropShadow dx="0" dy="1" stdDeviation="0.5" flood-color="#000" flood-opacity="0.9"/>');
  lines.push('      <feDropShadow dx="0" dy="-0.5" stdDeviation="0.3" flood-color="#FFF" flood-opacity="0.3"/>');
  lines.push('    </filter>');
  lines.push('    <filter id="dmg-shadow" x="-4%" y="-8%" width="108%" height="116%">');
  lines.push('      <feDropShadow dx="1" dy="1.5" stdDeviation="1" flood-color="#000" flood-opacity="0.8"/>');
  lines.push('    </filter>');
  lines.push(`    <clipPath id="card-clip"><rect width="${CARD_W}" height="${CARD_H}" rx="25" ry="25"/></clipPath>`);
  lines.push("  </defs>");

  // Full card image
  lines.push('  <g clip-path="url(#card-clip)">');
  lines.push(`    <image x="0" y="0" width="${CARD_W}" height="${CARD_H}" preserveAspectRatio="xMidYMid slice"`);
  lines.push(`           href="data:image/png;base64,${imageB64}"/>`);
  lines.push(`    <rect x="0" y="0" width="${CARD_W}" height="${headerH + 40}" fill="url(#header-grad)"/>`);
  const overlayH = CARD_H - overlayTop;
  lines.push(`    <rect x="0" y="${overlayTop}" width="${CARD_W}" height="${overlayH}" fill="url(#overlay-grad)"/>`);
  lines.push('  </g>');

  // Solid black footer strip
  const footerStripH = 90;
  lines.push(`  <rect x="0" y="${CARD_H - footerStripH}" width="${CARD_W}" height="${footerStripH}" rx="0" fill="#000" clip-path="url(#card-clip)"/>`);

  // Border
  lines.push(`  <rect width="${CARD_W}" height="${CARD_H}" rx="25" ry="25" fill="none" stroke="${color}" stroke-width="7"/>`);
  lines.push(`  <rect x="4" y="4" width="${CARD_W - 8}" height="${CARD_H - 8}" rx="21" ry="21" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>`);

  // Header rendering
  const evolveFrom = (card.evolveFrom as string) ?? "";
  const nameY = 62;

  if (category === "Energy") {
    lines.push(`  <text x="30" y="24" font-family="${FONT_BODY}" font-size="14" font-weight="700" fill="rgba(255,255,255,0.5)" letter-spacing="2">ENERGY</text>`);
    const tag = "SPECIAL";
    const tagW = measureWidth("title", tag, 16) + 20;
    const tagX = CARD_W - 30 - tagW;
    lines.push(`  <rect x="${tagX}" y="10" width="${tagW}" height="24" rx="12" fill="${color}" opacity="0.9"/>`);
    lines.push(`  <text x="${tagX + tagW / 2}" y="27" font-family="${FONT_TITLE}" font-size="16" font-weight="900" fill="white" text-anchor="middle">${tag}</text>`);
    const nameSize = fitNameSize(name, 48, CARD_W - 60);
    lines.push(`  <text x="30" y="${nameY}" font-family="${FONT_TITLE}" font-size="${nameSize}" font-weight="900" fill="white" style="paint-order:stroke fill" stroke="#000" stroke-width="2.5" stroke-linejoin="round" filter="url(#title-shadow)">${name}</text>`);
  } else if (category === "Trainer") {
    lines.push(`  <text x="30" y="24" font-family="${FONT_BODY}" font-size="14" font-weight="700" fill="rgba(255,255,255,0.5)" letter-spacing="2">TRAINER</text>`);
    if (trainerType) {
      const tag = escapeXml(trainerType).toUpperCase();
      const tagColors: Record<string, string> = { SUPPORTER: "#E85020", STADIUM: "#1A7A3A", ITEM: "#2080C0", TOOL: "#2080C0" };
      const tagFill = tagColors[tag] ?? "#888";
      const tagW = measureWidth("title", tag, 16) + 20;
      const tagX = CARD_W - 30 - tagW;
      lines.push(`  <rect x="${tagX}" y="10" width="${tagW}" height="24" rx="12" fill="${tagFill}" opacity="0.9"/>`);
      lines.push(`  <text x="${tagX + tagW / 2}" y="27" font-family="${FONT_TITLE}" font-size="16" font-weight="900" fill="white" text-anchor="middle">${tag}</text>`);
    }
    if (subtitle) {
      const mainEscaped = escapeXml(mainName);
      const subEscaped = escapeXml(subtitle);
      const mainSize = fitNameSize(mainEscaped, 48, CARD_W - 60);
      lines.push(`  <text x="30" y="${nameY}" font-family="${FONT_TITLE}" font-size="${mainSize}" font-weight="900" fill="white" style="paint-order:stroke fill" stroke="#000" stroke-width="2.5" stroke-linejoin="round" filter="url(#title-shadow)">${mainEscaped}</text>`);
      lines.push(`  <text x="30" y="${nameY + Math.floor(mainSize * 0.7)}" font-family="${FONT_BODY}" font-size="22" font-weight="600" fill="rgba(255,255,255,0.65)" font-style="italic" filter="url(#shadow)">${subEscaped}</text>`);
    } else {
      const nameSize = fitNameSize(name, 48, CARD_W - 60);
      lines.push(`  <text x="30" y="${nameY}" font-family="${FONT_TITLE}" font-size="${nameSize}" font-weight="900" fill="white" style="paint-order:stroke fill" stroke="#000" stroke-width="2.5" stroke-linejoin="round" filter="url(#title-shadow)">${name}</text>`);
    }
  } else if (hp) {
    // Pokemon header (V/EX/VMAX/VSTAR style)
    if (nameSuffix) {
      const tagText = nameSuffix === "ex" ? nameSuffix.toLowerCase() : nameSuffix;
      const tagSize = 14;
      const tagW = measureWidth("title", tagText, tagSize) + 16;
      const gradId = `grad-${nameSuffix}`;
      lines.push(`  <rect x="18" y="10" width="${tagW}" height="22" rx="4" fill="url(#${gradId})" stroke="rgba(0,0,0,0.5)" stroke-width="1.5"/>`);
      lines.push(`  <text x="${18 + tagW / 2}" y="26" font-family="${FONT_TITLE}" font-size="${tagSize}" font-weight="900" fill="${nameSuffix === "ex" ? "#FFF" : "#333"}" text-anchor="middle">${escapeXml(tagText)}</text>`);
    }
    // HP + energy dot
    const hpStr = String(hp);
    const hpSize = 50;
    const hpW = measureWidth("title", hpStr, hpSize);
    const hpLabelSize = 18;
    const hpLabelW = measureWidth("title", "HP", hpLabelSize);
    const dotR = 28;
    let rightX = CARD_W - 32;
    if (types.length) {
      lines.push(`  ${renderTypeIcon(rightX, 42, dotR, cardType)}`);
      rightX -= dotR + 6;
    }
    lines.push(`  <text x="${rightX}" y="${nameY}" font-family="${FONT_TITLE}" font-size="${hpSize}" font-weight="900" fill="white" text-anchor="end" style="paint-order:stroke fill" stroke="#000" stroke-width="3" stroke-linejoin="round" filter="url(#title-shadow)">${escapeXml(hpStr)}</text>`);
    const hpNumLeft = rightX - hpW;
    lines.push(`  <text x="${hpNumLeft - 4}" y="30" font-family="${FONT_TITLE}" font-size="${hpLabelSize}" font-weight="900" fill="rgba(255,255,255,0.7)" text-anchor="end">HP</text>`);

    const rightReserve = CARD_W - hpNumLeft + hpLabelW + 30;
    const nameAvail = CARD_W - rightReserve - 20;

    if (nameSuffix) {
      const baseEscaped = escapeXml(baseName);
      const suffixEscaped = escapeXml(nameSuffix);
      const suffixSizeRatio = nameSuffix === "ex" ? 0.95 : 0.85;
      const maxNameSize = 48;
      const testSuffixSize = Math.floor(maxNameSize * suffixSizeRatio);
      const suffixW = measureWidth("title", nameSuffix, testSuffixSize) + 4;
      const nameSize = fitNameSize(baseName, maxNameSize, nameAvail - suffixW);
      const actualSuffixSize = Math.floor(nameSize * suffixSizeRatio);
      const baseW = measureWidth("title", baseName, nameSize);
      lines.push(`  <text x="30" y="${nameY}" font-family="${FONT_TITLE}" font-size="${nameSize}" font-weight="900" fill="white" style="paint-order:stroke fill" stroke="#000" stroke-width="2.5" stroke-linejoin="round" filter="url(#title-shadow)">${baseEscaped}</text>`);
      const sx = 30 + baseW + 2;
      const gradId = `grad-${nameSuffix}`;
      const italicAttr = nameSuffix === "ex" ? ' font-style="italic"' : "";
      lines.push(`  <text x="${sx}" y="${nameY}" font-family="${FONT_TITLE}" font-size="${actualSuffixSize}" font-weight="900" fill="url(#${gradId})" style="paint-order:stroke fill" stroke="#000" stroke-width="4" stroke-linejoin="round"${italicAttr} filter="url(#suffix-emboss)">${suffixEscaped}</text>`);
    } else {
      const nameSize = fitNameSize(name, 48, nameAvail);
      lines.push(`  <text x="30" y="${nameY}" font-family="${FONT_TITLE}" font-size="${nameSize}" font-weight="900" fill="white" style="paint-order:stroke fill" stroke="#000" stroke-width="2.5" stroke-linejoin="round" filter="url(#title-shadow)">${name}</text>`);
    }
  } else {
    const nameSize = fitNameSize(name, 48, CARD_W - 60);
    lines.push(`  <text x="30" y="${nameY}" font-family="${FONT_TITLE}" font-size="${nameSize}" font-weight="900" fill="white" style="paint-order:stroke fill" stroke="#000" stroke-width="2.5" stroke-linejoin="round" filter="url(#title-shadow)">${name}</text>`);
  }
  if (evolveFrom) {
    lines.push(`  <text x="30" y="86" font-family="${FONT_BODY}" font-size="18" font-weight="600" fill="rgba(255,255,255,0.7)" font-style="italic" filter="url(#shadow)">Evolves from ${escapeXml(evolveFrom)}</text>`);
  }

  // Text content
  let y = overlayTop + textPad + Math.floor(BODY_SIZE * 0.5);

  // Trainer / Energy effect text
  if ((category === "Trainer" || category === "Energy") && trainerEffect) {
    const wrapped = ftWrap("body", trainerEffect, BODY_SIZE, textMaxW);
    for (const wline of wrapped) {
      y += LINE_H;
      renderTextLineWithEnergy(lines, wline, MARGIN, y, BODY_SIZE, FONT_BODY, "white", ' filter="url(#shadow)"');
    }
    y += Math.floor(BODY_SIZE * 0.83);
  }

  // Abilities
  for (const ab of abilities) {
    const abType = (ab.type as string) ?? "Ability";
    const abName = (ab.name as string) ?? "";
    const abEffect = (ab.effect as string) ?? "";

    const barH = Math.floor(HEAD_SIZE * 1.5);
    const barY = y - Math.floor(HEAD_SIZE * 1.07);
    const barCenterY = barY + Math.floor(barH / 2);
    lines.push(`  <rect x="20" y="${barY}" width="${CARD_W - 40}" height="${barH}" rx="6" fill="${color}" opacity="0.75"/>`);
    lines.push(`  <rect x="20" y="${barY}" width="${CARD_W - 40}" height="3" rx="2" fill="white" opacity="0.25"/>`);
    const abLabel = `${abType}: ${abName}`;
    const abLabelSize = fitAbilityHeader(abLabel, HEAD_SIZE, CARD_W - 2 * MARGIN - 10);
    lines.push(`  <text x="${MARGIN}" y="${barCenterY}" font-family="${FONT_TITLE}" font-size="${abLabelSize}" font-weight="900" fill="white" dominant-baseline="central" style="paint-order:stroke fill" stroke="rgba(0,0,0,0.4)" stroke-width="2" stroke-linejoin="round" filter="url(#shadow)">${escapeXml(abLabel)}</text>`);
    y += Math.floor(HEAD_SIZE * 0.5);

    const wrapped = ftWrap("body", abEffect, BODY_SIZE, textMaxW);
    for (const wline of wrapped) {
      y += LINE_H;
      renderTextLineWithEnergy(lines, wline, MARGIN, y, BODY_SIZE, FONT_BODY, "white", ' filter="url(#shadow)"');
    }
    y += Math.floor(BODY_SIZE * 1.46);
  }

  // Attacks
  for (const atk of attacks) {
    const atkCost = (atk.cost as string[]) ?? [];
    const atkName = escapeXml((atk.name as string) ?? "");
    const damage = atk.damage as string | number | undefined;
    const effect = (atk.effect as string) ?? "";

    const barH = Math.floor(HEAD_SIZE * 1.6);
    const barY = y - Math.floor(HEAD_SIZE * 1.0);
    const barCenterY = barY + Math.floor(barH / 2);
    lines.push(`  <rect x="20" y="${barY}" width="${CARD_W - 40}" height="${barH}" rx="6" fill="${color}" opacity="0.2"/>`);
    lines.push(`  <rect x="20" y="${barY}" width="${CARD_W - 40}" height="${barH}" rx="6" fill="white" opacity="0.06"/>`);
    lines.push(`  <rect x="20" y="${barY}" width="${CARD_W - 40}" height="2" rx="1" fill="white" opacity="0.15"/>`);

    const dotR = Math.max(10, Math.floor(HEAD_SIZE * 0.55));
    let dotX = MARGIN;
    if (atkCost.length) {
      const [dotElems, dotW] = renderEnergyDots(MARGIN, barCenterY, atkCost, dotR);
      lines.push(...dotElems);
      dotX = MARGIN + dotW + 6;
    }

    const [atkNameSize, atkDmgSize] = fitAttackHeader(atkName, damage, atkCost.length, HEAD_SIZE, CARD_W, MARGIN);
    lines.push(`  <text x="${dotX}" y="${barCenterY}" font-family="${FONT_TITLE}" font-size="${atkNameSize}" font-weight="900" fill="white" dominant-baseline="central" style="paint-order:stroke fill" stroke="rgba(0,0,0,0.3)" stroke-width="1.5" stroke-linejoin="round" filter="url(#shadow)">${atkName}</text>`);
    if (damage) {
      lines.push(`  <text x="${CARD_W - MARGIN}" y="${barCenterY}" font-family="${FONT_TITLE}" font-size="${atkDmgSize}" font-weight="900" fill="#FF5533" text-anchor="end" dominant-baseline="central" style="paint-order:stroke fill" stroke="#000" stroke-width="2" stroke-linejoin="round" filter="url(#dmg-shadow)">${escapeXml(String(damage))}</text>`);
    }
    y += Math.floor(HEAD_SIZE * 0.64);

    if (effect) {
      const wrapped = ftWrap("body", effect, BODY_SIZE, textMaxW);
      for (const wline of wrapped) {
        y += LINE_H;
        renderTextLineWithEnergy(lines, wline, MARGIN, y, BODY_SIZE, FONT_BODY, "white", ' filter="url(#shadow)"');
      }
    }
    y += Math.floor(BODY_SIZE * 1.25);
  }

  // Rules text
  let ruleText = "";
  if (category === "Pokemon" && suffix in POKEMON_RULES) ruleText = POKEMON_RULES[suffix];
  else if (category === "Trainer" && trainerType in TRAINER_RULES) ruleText = TRAINER_RULES[trainerType];
  if (ruleText) {
    const ruleSize = 16;
    const ruleLines = ftWrap("body", ruleText, ruleSize, textMaxW);
    y += 4;
    for (const rl of ruleLines) {
      lines.push(`  <text x="${MARGIN}" y="${y}" font-family="${FONT_BODY}" font-size="${ruleSize}" font-weight="600" fill="rgba(255,255,255,0.6)" font-style="italic" filter="url(#shadow)">${escapeXml(rl)}</text>`);
      y += Math.floor(ruleSize * 1.3);
    }
  }

  renderFooterSvg(lines, card, category, cardType, retreat, BODY_SIZE, setName, localId, {
    footerY: CARD_H - 55,
    sepOffset: 18,
    sepColor: "rgba(255,255,255,0.3)",
    fill: "rgba(255,255,255,0.9)",
    retreatDotFill: "white",
    infoY: CARD_H - 18,
    infoFill: "rgba(255,255,255,0.5)",
  });

  lines.push("</svg>");
  return lines.join("\n");
}


// ─── Standard (white bg) renderer ───

export function generateStandardSvg(card: Record<string, unknown>, artworkB64: string): string {
  const name = escapeXml((card.name as string) ?? "Unknown");
  const hp = card.hp as number | undefined;
  const types = (card.types as string[]) ?? [];
  const cardType = types[0] ?? "Colorless";
  let color = TYPE_COLORS[cardType] ?? "#888888";
  const retreat = (card.retreat as number) ?? 0;
  let abilities = (card.abilities as Array<Record<string, unknown>>) ?? [];
  let attacks = (card.attacks as Array<Record<string, unknown>>) ?? [];
  const setName = ((card.set as Record<string, unknown>)?.name as string) ?? "";
  const localId = (card.localId as string) ?? "";
  const category = (card.category as string) ?? "Pokemon";
  const trainerType = (card.trainerType as string) ?? "";
  const trainerEffect = compressText((card.effect as string) ?? "");

  abilities = abilities.map(ab => ({ ...ab, effect: compressText((ab.effect as string) ?? "") }));
  attacks = attacks.map(atk => ({ ...atk, effect: compressText((atk.effect as string) ?? "") }));

  if (category === "Trainer") {
    if (trainerType === "Supporter") color = "#C04010";
    else if (trainerType === "Stadium") color = "#1A7A3A";
    else color = "#1860A0";
  }

  const lines: string[] = [];
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CARD_W} ${CARD_H}" width="${CARD_W}" height="${CARD_H}">`);
  lines.push("  <defs>");
  lines.push(`    ${getFontStyle()}`);
  lines.push(`    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">`);
  lines.push(`      <stop offset="0%" stop-color="${color}" stop-opacity="0.3"/>`);
  lines.push(`      <stop offset="100%" stop-color="${color}" stop-opacity="0.1"/>`);
  lines.push("    </linearGradient>");
  lines.push('    <filter id="shadow" x="-2%" y="-2%" width="104%" height="104%">');
  lines.push('      <feDropShadow dx="1" dy="1" stdDeviation="0.8" flood-color="#000" flood-opacity="0.35"/>');
  lines.push("    </filter>");
  lines.push('    <filter id="shadow-title" x="-2%" y="-5%" width="104%" height="110%">');
  lines.push('      <feDropShadow dx="1.5" dy="2" stdDeviation="1" flood-color="#000" flood-opacity="0.5"/>');
  lines.push("    </filter>");
  // Tag outline filter
  lines.push('    <filter id="tag-outline" x="-8%" y="-20%" width="116%" height="140%">');
  lines.push('      <feMorphology in="SourceAlpha" operator="dilate" radius="4" result="outer"/>');
  lines.push('      <feFlood flood-color="#000" flood-opacity="0.8" result="black"/>');
  lines.push('      <feComposite in="black" in2="outer" operator="in" result="outer-stroke"/>');
  lines.push('      <feMorphology in="SourceAlpha" operator="dilate" radius="2" result="inner"/>');
  lines.push('      <feFlood flood-color="white" flood-opacity="0.95" result="white"/>');
  lines.push('      <feComposite in="white" in2="inner" operator="in" result="inner-stroke"/>');
  lines.push('      <feMerge>');
  lines.push('        <feMergeNode in="outer-stroke"/>');
  lines.push('        <feMergeNode in="inner-stroke"/>');
  lines.push('        <feMergeNode in="SourceGraphic"/>');
  lines.push('      </feMerge>');
  lines.push("    </filter>");
  lines.push("  </defs>");

  // Background
  lines.push(`  <rect width="${CARD_W}" height="${CARD_H}" rx="25" ry="25" fill="white"/>`);
  lines.push(`  <rect width="${CARD_W}" height="${CARD_H}" rx="25" ry="25" fill="url(#bg)" stroke="${color}" stroke-width="4"/>`);

  // Header bar
  lines.push(`  <rect x="0" y="0" width="${CARD_W}" height="80" rx="25" ry="25" fill="${color}" opacity="0.85"/>`);
  lines.push(`  <rect x="0" y="40" width="${CARD_W}" height="40" fill="${color}" opacity="0.85"/>`);

  // Name and HP/trainer type
  const rightReserve = category === "Trainer" ? 70 : 140;
  const nameAvail = CARD_W - 30 - rightReserve - 20;
  const nameSize = fitNameSize(name, 42, nameAvail);
  lines.push(`  <text x="30" y="57" font-family="${FONT_TITLE}" font-size="${nameSize}" font-weight="900" fill="white" filter="url(#shadow-title)">${name}</text>`);

  if (category === "Trainer") {
    const iconSize = 40;
    const iconX = CARD_W - 30 - iconSize;
    const iconY = 20;
    const iconColors: Record<string, string> = { Supporter: "#FFD040", Stadium: "#50E878", Item: "#60C8FF", Tool: "#60C8FF" };
    const iconFill = iconColors[trainerType] ?? "#FFD040";
    if (trainerType === "Supporter") {
      lines.push(`  <g transform="translate(${iconX},${iconY})" filter="url(#tag-outline)">`);
      lines.push(`    <circle cx="${iconSize >> 1}" cy="${Math.floor(iconSize * 0.28)}" r="${Math.floor(iconSize * 0.22)}" fill="${iconFill}"/>`);
      lines.push(`    <path d="M${Math.floor(iconSize * 0.15)},${iconSize} Q${Math.floor(iconSize * 0.15)},${Math.floor(iconSize * 0.45)} ${iconSize >> 1},${Math.floor(iconSize * 0.42)} Q${Math.floor(iconSize * 0.85)},${Math.floor(iconSize * 0.45)} ${Math.floor(iconSize * 0.85)},${iconSize} Z" fill="${iconFill}"/>`);
      lines.push('  </g>');
    } else if (trainerType === "Item" || trainerType === "Tool") {
      const r = iconSize >> 1;
      const cx = iconX + r;
      const cy = iconY + r;
      lines.push('  <g filter="url(#tag-outline)">');
      lines.push(`    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${iconFill}" stroke="white" stroke-width="2"/>`);
      lines.push(`    <rect x="${cx - r}" y="${cy - 2}" width="${iconSize}" height="4" fill="white"/>`);
      lines.push(`    <circle cx="${cx}" cy="${cy}" r="${Math.floor(r * 0.3)}" fill="white" stroke="${iconFill}" stroke-width="2"/>`);
      lines.push('  </g>');
    } else if (trainerType === "Stadium") {
      const sx = iconX;
      const sy = iconY;
      const s = iconSize;
      lines.push('  <g filter="url(#tag-outline)">');
      lines.push(`    <polygon points="${sx},${sy + Math.floor(s * 0.4)} ${sx + (s >> 1)},${sy + Math.floor(s * 0.08)} ${sx + s},${sy + Math.floor(s * 0.4)}" fill="${iconFill}"/>`);
      lines.push(`    <rect x="${sx + Math.floor(s * 0.05)}" y="${sy + Math.floor(s * 0.82)}" width="${Math.floor(s * 0.9)}" height="${Math.floor(s * 0.12)}" rx="2" fill="${iconFill}"/>`);
      const cw = Math.floor(s * 0.12);
      const ch = Math.floor(s * 0.44);
      const ctop = sy + Math.floor(s * 0.38);
      for (const colX of [sx + Math.floor(s * 0.15), sx + (s >> 1) - (cw >> 1), sx + Math.floor(s * 0.85) - cw]) {
        lines.push(`    <rect x="${colX}" y="${ctop}" width="${cw}" height="${ch}" rx="1" fill="${iconFill}"/>`);
      }
      lines.push('  </g>');
    } else {
      const tag = trainerType ? escapeXml(trainerType).toUpperCase() : "TRAINER";
      const tFill = iconColors[trainerType] ?? "#FFD040";
      lines.push(`  <text x="${CARD_W - 30}" y="57" font-family="${FONT_TITLE}" font-size="30" font-weight="900" fill="${tFill}" text-anchor="end" filter="url(#tag-outline)">${tag}</text>`);
    }
  } else if (hp) {
    let hpTextX = CARD_W - 30;
    if (types.length) {
      const dotR = 26;
      const dotCx = CARD_W - 32;
      lines.push(`  ${renderTypeIcon(dotCx, 40, dotR, cardType)}`);
      hpTextX = dotCx - dotR - 8;
    }
    lines.push(`  <text x="${hpTextX}" y="57" font-family="${FONT_TITLE}" font-size="38" font-weight="900" fill="white" text-anchor="end" filter="url(#shadow-title)">${hp} HP</text>`);
  }

  // Subtitle line
  const evolveFrom = (card.evolveFrom as string) ?? "";
  let artY: number;
  if (category === "Trainer") {
    artY = 85;
  } else {
    const stage = (card.stage as string) ?? "Basic";
    const stageLine = stage || "Basic";
    const typeStr = types.join(" / ");
    const subtitleText = typeStr ? `${stageLine} — ${typeStr}` : stageLine;
    lines.push(`  <text x="30" y="105" font-family="${FONT_BODY}" font-size="22" font-weight="700" fill="#444" filter="url(#shadow)">${escapeXml(subtitleText)}</text>`);
    artY = 118;
    if (evolveFrom) {
      lines.push(`  <text x="30" y="125" font-family="${FONT_BODY}" font-size="18" font-weight="600" fill="#888" font-style="italic">Evolves from ${escapeXml(evolveFrom)}</text>`);
      artY = 135;
    }
  }

  // Artwork + text layout
  const artX = 20;
  const artW = CARD_W - 40;
  const ART_H_MAX = Math.floor(artW / 1.59);
  const ART_H_MIN = 200;
  const ART_PAD = 40;
  const contentBottom = CARD_H - 90;
  const textMaxW = CARD_W - 2 * MARGIN;

  const hasText = !!((category === "Trainer" || category === "Energy") && trainerEffect) || abilities.length > 0 || attacks.length > 0;
  const HEAD_RATIO = 28 / 24;
  const BODY_LARGE = 40, BODY_MEDIUM = 34, BODY_SMALL = 28;
  const ART_PREFER = 300;

  function _measure(body: number): number {
    return ftContentHeight(body, Math.floor(body * HEAD_RATIO), textMaxW, category, trainerEffect, abilities, attacks, card);
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

  let BODY_SIZE: number;
  let HEAD_SIZE: number;
  let LINE_H: number;
  let artH: number;

  if (hasText) {
    const textHLarge = _measure(BODY_LARGE);

    if (textHLarge <= space - ART_H_MAX) {
      BODY_SIZE = BODY_LARGE;
      artH = Math.min(ART_H_MAX, space - textHLarge);
    } else if (textHLarge <= space - ART_PREFER) {
      [BODY_SIZE, , artH] = _bestInRange(BODY_MEDIUM, BODY_LARGE);
    } else if (_measure(BODY_MEDIUM) <= space - ART_PREFER) {
      [BODY_SIZE, , artH] = _bestInRange(BODY_MEDIUM, BODY_LARGE);
    } else if (_measure(BODY_SMALL) <= space - ART_PREFER) {
      [BODY_SIZE, , artH] = _bestInRange(BODY_SMALL, BODY_MEDIUM);
    } else if (_measure(BODY_SMALL) <= space - ART_H_MIN) {
      BODY_SIZE = BODY_SMALL;
      const th = _measure(BODY_SIZE);
      artH = Math.max(ART_H_MIN, Math.min(ART_H_MAX, space - th));
    } else {
      BODY_SIZE = BODY_SMALL;
      const th = _measure(BODY_SIZE);
      artH = Math.max(ART_H_MIN, space - th);
    }

    HEAD_SIZE = Math.floor(BODY_SIZE * HEAD_RATIO);
    LINE_H = Math.floor(BODY_SIZE * 1.25);
  } else {
    artH = ART_H_MAX;
    BODY_SIZE = BODY_LARGE;
    HEAD_SIZE = Math.floor(BODY_LARGE * HEAD_RATIO);
    LINE_H = Math.floor(BODY_LARGE * 1.25);
  }

  // Artwork (SVG-cropped to art region)
  const srcW = 600, srcH = 825;
  const cropX = ART_LEFT, cropY = ART_TOP;
  const cropW = ART_RIGHT - ART_LEFT, cropH = ART_BOTTOM - ART_TOP;
  lines.push(`  <rect x="${artX}" y="${artY}" width="${artW}" height="${artH}" rx="10" fill="#000" opacity="0.05"/>`);
  lines.push(`  <svg x="${artX}" y="${artY}" width="${artW}" height="${artH}" viewBox="${cropX} ${cropY} ${cropW} ${cropH}" preserveAspectRatio="xMidYMid slice">`);
  lines.push(`    <image width="${srcW}" height="${srcH}" href="data:image/png;base64,${artworkB64}"/>`);
  lines.push(`  </svg>`);
  lines.push(`  <rect x="${artX}" y="${artY}" width="${artW}" height="${artH}" rx="10" fill="none" stroke="rgba(0,0,0,0.12)" stroke-width="1"/>`);

  let y = artY + artH + ART_PAD;

  // Trainer / Energy effect text
  if ((category === "Trainer" || category === "Energy") && trainerEffect) {
    const wrapped = ftWrap("body", trainerEffect, BODY_SIZE, textMaxW);
    for (const wline of wrapped) {
      y += LINE_H;
      renderTextLineWithEnergy(lines, wline, MARGIN, y, BODY_SIZE, FONT_BODY, "#222", ' filter="url(#shadow)"');
    }
    y += Math.floor(BODY_SIZE * 0.83);
  }

  // Abilities
  for (const ab of abilities) {
    const abType = (ab.type as string) ?? "Ability";
    const abName = escapeXml((ab.name as string) ?? "");
    const abEffect = (ab.effect as string) ?? "";

    const barH = Math.floor(HEAD_SIZE * 1.5);
    const barY = y - Math.floor(HEAD_SIZE * 1.07);
    const barCenterY = barY + Math.floor(barH / 2);
    lines.push(`  <rect x="20" y="${barY}" width="${CARD_W - 40}" height="${barH}" rx="5" fill="${color}" opacity="0.25"/>`);
    const abLabel = `${escapeXml(abType)}: ${abName}`;
    const abLabelSize = fitAbilityHeader(abLabel, HEAD_SIZE, CARD_W - 2 * MARGIN - 10);
    lines.push(`  <text x="${MARGIN}" y="${barCenterY}" font-family="${FONT_TITLE}" font-size="${abLabelSize}" font-weight="900" fill="${color}" dominant-baseline="central" filter="url(#shadow)">${abLabel}</text>`);
    y += Math.floor(HEAD_SIZE * 0.5);

    const wrapped = ftWrap("body", abEffect, BODY_SIZE, textMaxW);
    for (const wline of wrapped) {
      y += LINE_H;
      renderTextLineWithEnergy(lines, wline, MARGIN, y, BODY_SIZE, FONT_BODY, "#222", ' filter="url(#shadow)"');
    }
    y += Math.floor(BODY_SIZE * 1.46);
  }

  // Attacks
  for (const atk of attacks) {
    const atkCost = (atk.cost as string[]) ?? [];
    const atkName = escapeXml((atk.name as string) ?? "");
    const damage = atk.damage as string | number | undefined;
    const effect = (atk.effect as string) ?? "";

    const barH = Math.floor(HEAD_SIZE * 1.57);
    const barY = y - Math.floor(HEAD_SIZE * 1.0);
    const barCenterY = barY + Math.floor(barH / 2);
    lines.push(`  <rect x="20" y="${barY}" width="${CARD_W - 40}" height="${barH}" rx="5" fill="#333" opacity="0.1"/>`);

    const dotR = Math.max(8, Math.floor(HEAD_SIZE * 0.5));
    let dotX = MARGIN;
    if (atkCost.length) {
      const [dotElems, dotW] = renderEnergyDots(MARGIN, barCenterY, atkCost, dotR);
      lines.push(...dotElems);
      dotX = MARGIN + dotW + 6;
    }

    const [atkNameSize, atkDmgSize] = fitAttackHeader(atkName, damage, atkCost.length, HEAD_SIZE, CARD_W, MARGIN);
    lines.push(`  <text x="${dotX}" y="${barCenterY}" font-family="${FONT_TITLE}" font-size="${atkNameSize}" font-weight="900" fill="#222" dominant-baseline="central" filter="url(#shadow)">${atkName}</text>`);
    if (damage) {
      lines.push(`  <text x="${CARD_W - MARGIN}" y="${barCenterY}" font-family="${FONT_TITLE}" font-size="${atkDmgSize}" font-weight="900" fill="#c00" text-anchor="end" dominant-baseline="central" filter="url(#shadow)">${escapeXml(String(damage))}</text>`);
    }
    y += Math.floor(HEAD_SIZE * 0.64);

    if (effect) {
      const wrapped = ftWrap("body", effect, BODY_SIZE, textMaxW);
      for (const wline of wrapped) {
        y += LINE_H;
        renderTextLineWithEnergy(lines, wline, MARGIN, y, BODY_SIZE, FONT_BODY, "#222", ' filter="url(#shadow)"');
      }
    }
    y += Math.floor(BODY_SIZE * 1.25);
  }

  // Rules text
  const suffix = getPokemonSuffix(card);
  let ruleText = "";
  if (category === "Pokemon" && suffix in POKEMON_RULES) ruleText = POKEMON_RULES[suffix];
  else if (category === "Trainer" && trainerType in TRAINER_RULES) ruleText = TRAINER_RULES[trainerType];
  if (ruleText) {
    const ruleSize = 16;
    const ruleLines = ftWrap("body", ruleText, ruleSize, textMaxW);
    y += 4;
    for (const rl of ruleLines) {
      lines.push(`  <text x="${MARGIN}" y="${y}" font-family="${FONT_BODY}" font-size="${ruleSize}" font-weight="600" fill="#999" font-style="italic">${escapeXml(rl)}</text>`);
      y += Math.floor(ruleSize * 1.3);
    }
  }

  renderFooterSvg(lines, card, category, cardType, retreat, BODY_SIZE, setName, localId, {
    footerY: CARD_H - 60,
    sepOffset: 20,
    sepColor: "#ccc",
    fill: "#444",
    retreatDotFill: "#ddd",
    infoY: CARD_H - 20,
    infoFill: "#888",
  });

  lines.push("</svg>");
  return lines.join("\n");
}


// ─── Basic energy renderer ───

export function generateBasicEnergySvg(card: Record<string, unknown>, imageB64: string): string {
  const types = (card.types as string[]) ?? [];
  const energyType = types[0] ?? "Colorless";
  const color = TYPE_COLORS[energyType] ?? "#888888";
  const setName = ((card.set as Record<string, unknown>)?.name as string) ?? "";
  const localId = (card.localId as string) ?? "";

  const lines: string[] = [];
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CARD_W} ${CARD_H}" width="${CARD_W}" height="${CARD_H}">`);
  lines.push("  <defs>");
  lines.push(`    ${getFontStyle()}`);
  lines.push(`    <clipPath id="card-clip"><rect width="${CARD_W}" height="${CARD_H}" rx="25" ry="25"/></clipPath>`);
  lines.push("  </defs>");
  lines.push('  <g clip-path="url(#card-clip)">');
  lines.push(`    <image x="0" y="0" width="${CARD_W}" height="${CARD_H}" preserveAspectRatio="xMidYMid slice"`);
  lines.push(`           href="data:image/png;base64,${imageB64}"/>`);
  lines.push('  </g>');
  lines.push(`  <rect width="${CARD_W}" height="${CARD_H}" rx="25" ry="25" fill="none" stroke="${color}" stroke-width="4"/>`);
  lines.push(`  <text x="${CARD_W >> 1}" y="${CARD_H - 20}" font-family="${FONT_BODY}" font-size="18" font-weight="600" fill="rgba(255,255,255,0.7)" text-anchor="middle">${escapeXml(setName)} ${escapeXml(localId)}</text>`);
  lines.push("</svg>");
  return lines.join("\n");
}


// ─── Print HTML ───

export function generatePrintHtml(cards: [number, string][]): string {
  const parts: string[] = [];
  parts.push(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>PokeProxy - Print Sheet</title>
<style>
  @page { size: letter; margin: 0.25in; }
  body { margin: 0; padding: 0.25in; }
  .card-grid {
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
  }
  .card {
    width: 2.5in;
    height: 3.5in;
    page-break-inside: avoid;
    overflow: hidden;
  }
  .card svg {
    width: 100%;
    height: 100%;
  }
  @media print {
    body { padding: 0; }
  }
</style>
</head>
<body>
<div class="card-grid">
`);
  for (const [count, svgContent] of cards) {
    const svgClean = svgContent.replace(/<\?xml[^?]*\?>\s*/g, "");
    for (let i = 0; i < count; i++) {
      parts.push(`<div class="card">${svgClean}</div>\n`);
    }
  }
  parts.push(`</div>
</body>
</html>
`);
  return parts.join("");
}

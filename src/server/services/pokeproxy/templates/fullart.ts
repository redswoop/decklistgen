/**
 * Full-art card template — full image background, gradient overlay, white text.
 * Artist-editable: gradients, opacities, colors, positions.
 */

import type { CardProps } from "./types.js";
import {
  CARD_W, CARD_H, FONT_TITLE, FONT_BODY, MARGIN,
  POKEMON_RULES, TRAINER_RULES,
} from "../constants.js";
import { getFontStyle, renderTypeIcon } from "../type-icons.js";
import {
  escapeXml, energyInlineSvg, renderTextLineWithEnergy, renderEnergyDots,
  renderFooterSvg, fitAbilityHeader,
} from "../svg-helpers.js";
import { measureWidth, ftWrap, fitAttackHeader, fitNameSize } from "../text.js";

export function render(props: CardProps): string {
  const {
    name, rawName, baseName, nameSuffix, mainName, subtitle, suffix,
    hp, types, cardType, color, category, trainerType,
    evolveFrom, retreat, setName, localId,
    trainerEffect, abilities, attacks,
    layout, imageB64, card,
  } = props;
  const { bodySize: BODY_SIZE, headSize: HEAD_SIZE, lineH: LINE_H, overlayTop: rawOverlayTop } = layout;
  const overlayTop = rawOverlayTop!;
  const textMaxW = CARD_W - 2 * MARGIN;
  const overlayOpacity = 0.7;
  const headerH = 100;
  const textPad = 50;

  const lines: string[] = [];

  // ── SVG open + defs ──
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
  lines.push('      <stop offset="0%" stop-color="#FF4477"/>');
  lines.push('      <stop offset="25%" stop-color="#FF9920"/>');
  lines.push('      <stop offset="50%" stop-color="#33CCFF"/>');
  lines.push('      <stop offset="75%" stop-color="#66EE44"/>');
  lines.push('      <stop offset="100%" stop-color="#CC66FF"/>');
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

  // ── Full card image ──
  lines.push('  <g clip-path="url(#card-clip)">');
  lines.push(`    <image x="0" y="0" width="${CARD_W}" height="${CARD_H}" preserveAspectRatio="xMidYMid slice"`);
  lines.push(`           href="data:image/png;base64,${imageB64}"/>`);
  lines.push(`    <rect x="0" y="0" width="${CARD_W}" height="${headerH + 40}" fill="url(#header-grad)"/>`);
  const overlayH = CARD_H - overlayTop;
  lines.push(`    <rect x="0" y="${overlayTop}" width="${CARD_W}" height="${overlayH}" fill="url(#overlay-grad)"/>`);
  lines.push('  </g>');

  // ── Solid black footer strip ──
  const footerStripH = 90;
  lines.push(`  <rect x="0" y="${CARD_H - footerStripH}" width="${CARD_W}" height="${footerStripH}" rx="0" fill="#000" clip-path="url(#card-clip)"/>`);

  // ── Border ──
  lines.push(`  <rect width="${CARD_W}" height="${CARD_H}" rx="25" ry="25" fill="none" stroke="${color}" stroke-width="7"/>`);
  lines.push(`  <rect x="4" y="4" width="${CARD_W - 8}" height="${CARD_H - 8}" rx="21" ry="21" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>`);

  // ── Header ──
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
    // Pokemon header
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

  // ── Text content ──
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
    const abEffect = ab.effect;

    const barH = Math.floor(HEAD_SIZE * 1.5);
    const barY = y - Math.floor(HEAD_SIZE * 1.07);
    const barCenterY = barY + Math.floor(barH / 2);
    lines.push(`  <rect x="20" y="${barY}" width="${CARD_W - 40}" height="${barH}" rx="6" fill="${color}" opacity="0.55"/>`);
    lines.push(`  <rect x="20" y="${barY}" width="${CARD_W - 40}" height="3" rx="2" fill="white" opacity="0.2"/>`);
    const abLabel = `${ab.type}: ${ab.name}`;
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
    const atkName = escapeXml(atk.name);
    const damage = atk.damage;
    const effect = atk.effect;

    const barH = Math.floor(HEAD_SIZE * 1.6);
    const barY = y - Math.floor(HEAD_SIZE * 1.0);
    const barCenterY = barY + Math.floor(barH / 2);
    // Separator line above attack bar
    lines.push(`  <line x1="20" y1="${barY}" x2="${CARD_W - 20}" y2="${barY}" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>`);
    lines.push(`  <rect x="20" y="${barY}" width="${CARD_W - 40}" height="${barH}" rx="6" fill="${color}" opacity="0.2"/>`);
    lines.push(`  <rect x="20" y="${barY}" width="${CARD_W - 40}" height="${barH}" rx="6" fill="white" opacity="0.06"/>`);
    lines.push(`  <rect x="20" y="${barY}" width="${CARD_W - 40}" height="2" rx="1" fill="white" opacity="0.15"/>`);

    const dotR = Math.max(10, Math.floor(HEAD_SIZE * 0.48));
    let dotX = MARGIN;
    if (atk.cost.length) {
      const [dotElems, dotW] = renderEnergyDots(MARGIN, barCenterY, atk.cost, dotR);
      lines.push(...dotElems);
      dotX = MARGIN + dotW + 6;
    }

    const [atkNameSize, atkDmgSize] = fitAttackHeader(atkName, damage, atk.cost.length, HEAD_SIZE, CARD_W, MARGIN);
    lines.push(`  <text x="${dotX}" y="${barCenterY}" font-family="${FONT_TITLE}" font-size="${atkNameSize}" font-weight="900" fill="white" dominant-baseline="central" style="paint-order:stroke fill" stroke="rgba(0,0,0,0.3)" stroke-width="1.5" stroke-linejoin="round" filter="url(#shadow)">${atkName}</text>`);
    if (damage) {
      lines.push(`  <text x="${CARD_W - MARGIN}" y="${barCenterY - 2}" font-family="${FONT_TITLE}" font-size="${atkDmgSize}" font-weight="900" fill="#FF5533" text-anchor="end" dominant-baseline="central" style="paint-order:stroke fill" stroke="#000" stroke-width="2" stroke-linejoin="round" filter="url(#dmg-shadow)">${escapeXml(String(damage))}</text>`);
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

  // ── Rules text ──
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

  // ── Footer ──
  renderFooterSvg(lines, card, category, cardType, retreat, BODY_SIZE, setName, localId, {
    footerY: CARD_H - 55,
    sepOffset: 18,
    sepColor: "rgba(255,255,255,0.3)",
    fill: "rgba(255,255,255,0.9)",
    retreatDotFill: "white",
    infoY: CARD_H - 18,
    infoFill: "rgba(255,255,255,0.65)",
  });

  lines.push("</svg>");
  return lines.join("\n");
}

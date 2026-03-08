/**
 * Standard card template — white background, cropped artwork, dark text.
 * Artist-editable: colors, opacities, gradients, positions, spacing.
 */

import type { CardProps } from "./types.js";
import {
  CARD_W, CARD_H, FONT_TITLE, FONT_BODY, MARGIN,
  POKEMON_RULES, TRAINER_RULES,
  ART_TOP, ART_BOTTOM, ART_LEFT, ART_RIGHT,
} from "../constants.js";
import { getFontStyle, renderTypeIcon } from "../type-icons.js";
import {
  escapeXml, energyInlineSvg, renderTextLineWithEnergy, renderEnergyDots,
  renderFooterSvg, fitAbilityHeader,
} from "../svg-helpers.js";
import { measureWidth, ftWrap, fitAttackHeader, fitNameSize } from "../text.js";
import { renderSuffixLogo } from "../logos.js";

export function render(props: CardProps): string {
  const {
    name, rawName, baseName, nameSuffix, suffix,
    hp, types, cardType, color, category, trainerType,
    evolveFrom, stage, retreat, setName, localId,
    trainerEffect, abilities, attacks,
    layout, imageB64: artworkB64, card,
  } = props;
  const { bodySize: BODY_SIZE, headSize: HEAD_SIZE, lineH: LINE_H, artHeight: artH, artY } = layout;
  const textMaxW = CARD_W - 2 * MARGIN;
  const ART_PAD = 40;

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

  // ── Background ──
  lines.push(`  <rect width="${CARD_W}" height="${CARD_H}" rx="25" ry="25" fill="white"/>`);
  lines.push(`  <rect width="${CARD_W}" height="${CARD_H}" rx="25" ry="25" fill="url(#bg)" stroke="${color}" stroke-width="4"/>`);

  // ── Header bar ──
  lines.push(`  <rect x="0" y="0" width="${CARD_W}" height="80" rx="25" ry="25" fill="${color}" opacity="0.85"/>`);
  lines.push(`  <rect x="0" y="40" width="${CARD_W}" height="40" fill="${color}" opacity="0.85"/>`);

  // ── Name and HP/trainer type ──
  const rightReserve = category === "Trainer" ? 70 : 140;
  const nameAvail = CARD_W - 30 - rightReserve - 20;
  if (nameSuffix && (nameSuffix === "V" || nameSuffix === "ex")) {
    const logoH = Math.floor(42 * 0.9);
    const [, logoW] = renderSuffixLogo(nameSuffix, 0, 0, logoH);
    const nameSize = fitNameSize(escapeXml(baseName), 42, nameAvail - logoW - 4);
    const baseW = measureWidth("title", baseName, nameSize);
    lines.push(`  <text x="30" y="57" font-family="${FONT_TITLE}" font-size="${nameSize}" font-weight="900" fill="white" filter="url(#shadow-title)">${escapeXml(baseName)}</text>`);
    const sx = 30 + baseW + 4;
    const logoY = 57 - logoH + Math.floor(logoH * 0.15);
    const [logoSvg] = renderSuffixLogo(nameSuffix, sx, logoY, logoH, "url(#shadow-title)");
    lines.push(`  ${logoSvg}`);
  } else {
    const nameSize = fitNameSize(name, 42, nameAvail);
    lines.push(`  <text x="30" y="57" font-family="${FONT_TITLE}" font-size="${nameSize}" font-weight="900" fill="white" filter="url(#shadow-title)">${name}</text>`);
  }

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

  // ── Subtitle line ──
  if (category === "Trainer") {
    // artY already set in layout
  } else {
    const stageLine = stage || "Basic";
    const typeStr = types.join(" / ");
    const parts = [stageLine];
    if (evolveFrom) parts.push(`Evolves from ${evolveFrom}`);
    if (typeStr) parts.push(typeStr);
    const subtitleText = parts.join(" — ");
    lines.push(`  <text x="30" y="105" font-family="${FONT_BODY}" font-size="22" font-weight="700" fill="#444" filter="url(#shadow)">${escapeXml(subtitleText)}</text>`);
  }

  // ── Artwork (SVG-cropped to art region) ──
  const artX = 20;
  const artW = CARD_W - 40;
  // Source image is ~600x825; crop to the art region defined in constants
  const srcW = 600, srcH = 825;
  const cropX = ART_LEFT, cropY = ART_TOP;
  const cropW = ART_RIGHT - ART_LEFT, cropH = ART_BOTTOM - ART_TOP;
  lines.push(`  <rect x="${artX}" y="${artY}" width="${artW}" height="${artH}" rx="10" fill="#000" opacity="0.05"/>`);
  lines.push(`  <svg x="${artX}" y="${artY}" width="${artW}" height="${artH}" viewBox="${cropX} ${cropY} ${cropW} ${cropH}" preserveAspectRatio="xMidYMid slice">`);
  lines.push(`    <image width="${srcW}" height="${srcH}" href="data:image/png;base64,${artworkB64}"/>`);
  lines.push(`  </svg>`);
  // Rounded corners via overlay rects
  lines.push(`  <rect x="${artX}" y="${artY}" width="${artW}" height="${artH}" rx="10" fill="none" stroke="rgba(0,0,0,0.12)" stroke-width="1"/>`);

  let y = artY! + artH! + ART_PAD;

  // ── Trainer / Energy effect text ──
  if ((category === "Trainer" || category === "Energy") && trainerEffect) {
    const wrapped = ftWrap("body", trainerEffect, BODY_SIZE, textMaxW);
    for (const wline of wrapped) {
      y += LINE_H;
      renderTextLineWithEnergy(lines, wline, MARGIN, y, BODY_SIZE, FONT_BODY, "#222", ' filter="url(#shadow)"');
    }
    y += Math.floor(BODY_SIZE * 0.83);
  }

  // ── Abilities ──
  for (const ab of abilities) {
    const abEffect = ab.effect;

    const barH = Math.floor(HEAD_SIZE * 1.5);
    const barY = y - Math.floor(HEAD_SIZE * 1.07);
    const barCenterY = barY + Math.floor(barH / 2);
    lines.push(`  <rect x="20" y="${barY}" width="${CARD_W - 40}" height="${barH}" rx="5" fill="${color}" opacity="0.18"/>`);
    const abLabel = `${ab.type}: ${ab.name}`;
    const abLabelSize = fitAbilityHeader(abLabel, HEAD_SIZE, CARD_W - 2 * MARGIN - 10);
    lines.push(`  <text x="${MARGIN}" y="${barCenterY}" font-family="${FONT_TITLE}" font-size="${abLabelSize}" font-weight="900" fill="${color}" dominant-baseline="central" filter="url(#shadow)">${escapeXml(abLabel)}</text>`);
    y += Math.floor(HEAD_SIZE * 0.5);

    const wrapped = ftWrap("body", abEffect, BODY_SIZE, textMaxW);
    for (const wline of wrapped) {
      y += LINE_H;
      renderTextLineWithEnergy(lines, wline, MARGIN, y, BODY_SIZE, FONT_BODY, "#222", ' filter="url(#shadow)"');
    }
    y += Math.floor(BODY_SIZE * 1.46);
  }

  // ── Attacks ──
  for (const atk of attacks) {
    const atkName = escapeXml(atk.name);
    const damage = atk.damage;
    const effect = atk.effect;

    const barH = Math.floor(HEAD_SIZE * 1.57);
    const barY = y - Math.floor(HEAD_SIZE * 1.0);
    const barCenterY = barY + Math.floor(barH / 2);
    // Separator line above attack bar
    lines.push(`  <line x1="20" y1="${barY}" x2="${CARD_W - 20}" y2="${barY}" stroke="rgba(0,0,0,0.08)" stroke-width="1"/>`);
    lines.push(`  <rect x="20" y="${barY}" width="${CARD_W - 40}" height="${barH}" rx="5" fill="#333" opacity="0.1"/>`);

    const dotR = Math.max(8, Math.floor(HEAD_SIZE * 0.45));
    let dotX = MARGIN;
    if (atk.cost.length) {
      const [dotElems, dotW] = renderEnergyDots(MARGIN, barCenterY, atk.cost, dotR);
      lines.push(...dotElems);
      dotX = MARGIN + dotW + 6;
    }

    const [atkNameSize, atkDmgSize] = fitAttackHeader(atkName, damage, atk.cost.length, HEAD_SIZE, CARD_W, MARGIN);
    lines.push(`  <text x="${dotX}" y="${barCenterY}" font-family="${FONT_TITLE}" font-size="${atkNameSize}" font-weight="900" fill="#222" dominant-baseline="central" filter="url(#shadow)">${atkName}</text>`);
    if (damage) {
      lines.push(`  <text x="${CARD_W - MARGIN}" y="${barCenterY - 2}" font-family="${FONT_TITLE}" font-size="${atkDmgSize}" font-weight="900" fill="#c00" text-anchor="end" dominant-baseline="central" filter="url(#shadow)">${escapeXml(String(damage))}</text>`);
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

  // ── Rules text ──
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

  // ── Footer ──
  renderFooterSvg(lines, card, category, cardType, retreat, BODY_SIZE, setName, localId, {
    footerY: CARD_H - 60,
    sepOffset: 20,
    sepColor: "#ccc",
    fill: "#444",
    retreatDotFill: "#ddd",
    infoY: CARD_H - 18,
    infoFill: "#777",
  });

  lines.push("</svg>");
  return lines.join("\n");
}

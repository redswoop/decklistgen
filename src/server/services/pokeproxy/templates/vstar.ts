/**
 * VSTAR card template — fullart style, but with attacks above and the VSTAR
 * Power ability rendered below in a gold-accented bar.
 */

import type { CardProps } from "./types.js";
import {
  CARD_W, CARD_H, FONT_TITLE, FONT_BODY, MARGIN,
} from "../constants.js";
import { getLightPalette } from "../energy-palette-store.js";
import { getFontStyle, renderTypeIcon } from "../type-icons.js";
import {
  escapeXml, renderTextLineWithEnergy, renderEnergyDots,
  renderFooterSvg, fitAbilityHeader,
} from "../svg-helpers.js";
import { measureWidth, ftWrap, fitAttackHeader, fitNameSize } from "../text.js";
import { renderSuffixLogo } from "../logos.js";

export function render(props: CardProps): string {
  const {
    name, baseName, nameSuffix,
    hp, types, cardType, color, category,
    stage, evolveFrom, retreat, setName, localId,
    abilities, attacks,
    layout, imageB64, card,
  } = props;
  const { bodySize: BODY_SIZE, headSize: HEAD_SIZE, lineH: LINE_H, overlayTop: rawOverlayTop } = layout;
  const overlayTop = rawOverlayTop!;
  const textMaxW = CARD_W - 2 * MARGIN;
  const overlayOpacity = 0.7;
  const headerH = 100;
  const textPad = 50;

  const energyPalette = getLightPalette();
  const lines: string[] = [];

  // ── Pre-classify attacks and measure actual content height ──
  const oncePerGameFull = "You can't use more than 1 VSTAR Power in a game.";
  const oncePerGameCompressed = "Max 1 VSTAR Power in a game.";
  const isVstarPower = (effect?: string) => effect?.includes(oncePerGameFull) || effect?.includes(oncePerGameCompressed);
  const regularAttacks = attacks.filter(a => !isVstarPower(a.effect));
  const vstarPowerAttacks = attacks.filter(a => isVstarPower(a.effect));
  const vstarPowers: { name: string; effect: string; damage?: string; cost?: string[] }[] = [
    ...vstarPowerAttacks.map(a => ({ name: a.name, effect: a.effect || "", damage: a.damage, cost: a.cost })),
    ...abilities.map(a => ({ name: a.name, effect: a.effect || "" })),
  ];

  function stripOncePerGame(text: string): string {
    return text
      .replace(`(${oncePerGameFull})`, "")
      .replace(oncePerGameFull, "")
      .replace(`(${oncePerGameCompressed})`, "")
      .replace(oncePerGameCompressed, "")
      .trim();
  }

  // Measure actual content height for bottom-packing
  let contentH = 0;
  for (const atk of regularAttacks) {
    contentH += Math.floor(HEAD_SIZE * 0.64);
    if (atk.effect) {
      contentH += ftWrap("body", atk.effect, BODY_SIZE, textMaxW).length * LINE_H;
    }
    contentH += Math.floor(BODY_SIZE * 1.25);
  }
  for (const vp of vstarPowers) {
    contentH += Math.floor(HEAD_SIZE * 0.5);
    const cleanEffect = stripOncePerGame(vp.effect);
    if (cleanEffect) {
      contentH += ftWrap("body", cleanEffect, BODY_SIZE, textMaxW).length * LINE_H;
    }
    contentH += Math.floor(BODY_SIZE * 0.5);
  }

  // Pack content above the footer — compute the actual overlay position
  const footerStripH = 90;
  const contentBottom = CARD_H - footerStripH - 10;
  const packedOverlayTop = contentBottom - contentH - textPad - Math.floor(BODY_SIZE * 0.5);
  // Use the lower position (higher Y = more art visible)
  const actualOverlayTop = Math.max(overlayTop, packedOverlayTop);

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
  // Filters
  lines.push('    <filter id="shadow" x="-2%" y="-2%" width="104%" height="104%">');
  lines.push('      <feDropShadow dx="1" dy="1" stdDeviation="1.5" flood-color="#000" flood-opacity="0.7"/>');
  lines.push("    </filter>");
  lines.push('    <filter id="title-shadow" x="-3%" y="-8%" width="106%" height="116%">');
  lines.push('      <feDropShadow dx="1.5" dy="2" stdDeviation="1.5" flood-color="#000" flood-opacity="0.8"/>');
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
  const overlayH = CARD_H - actualOverlayTop;
  lines.push(`    <rect x="0" y="${actualOverlayTop}" width="${CARD_W}" height="${overlayH}" fill="url(#overlay-grad)"/>`);
  lines.push('  </g>');

  // ── Solid black footer strip ──
  lines.push(`  <rect x="0" y="${CARD_H - footerStripH}" width="${CARD_W}" height="${footerStripH}" rx="0" fill="#000" clip-path="url(#card-clip)"/>`);

  // ── Border ──
  lines.push(`  <rect width="${CARD_W}" height="${CARD_H}" rx="25" ry="25" fill="none" stroke="${color}" stroke-width="7"/>`);
  lines.push(`  <rect x="4" y="4" width="${CARD_W - 8}" height="${CARD_H - 8}" rx="21" ry="21" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>`);

  // ── Large decorative VSTAR V in top-left corner ──
  const bigLogoH = 280;
  const [bigLogoSvg] = renderSuffixLogo("VSTAR-big", -50, -38, bigLogoH);
  lines.push(`  <g opacity="0.7" clip-path="url(#card-clip)">${bigLogoSvg}</g>`);

  // ── Header: VSTAR tag + HP + name ──
  const nameY = 62;

  // HP + energy dot (right side)
  const hpStr = hp ? String(hp) : "";
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
  if (hp) {
    lines.push(`  <text x="${rightX}" y="${nameY}" font-family="${FONT_TITLE}" font-size="${hpSize}" font-weight="900" fill="white" text-anchor="end" style="paint-order:stroke fill" stroke="#000" stroke-width="3" stroke-linejoin="round" filter="url(#title-shadow)">${escapeXml(hpStr)}</text>`);
    const hpNumLeft = rightX - hpW;
    lines.push(`  <text x="${hpNumLeft - 4}" y="30" font-family="${FONT_TITLE}" font-size="${hpLabelSize}" font-weight="900" fill="rgba(255,255,255,0.7)" text-anchor="end">HP</text>`);

    // Name with VSTAR logo suffix
    const rightReserve = CARD_W - (rightX - hpW) + hpLabelW + 30;
    const nameAvail = CARD_W - rightReserve - 20;
    const baseEscaped = escapeXml(baseName);
    const maxNameSize = 48;
    const inlineLogoH = Math.floor(maxNameSize * 1.15);
    const [, estLogoW] = renderSuffixLogo("VSTAR", 0, 0, inlineLogoH);
    const nameSize = fitNameSize(baseName, maxNameSize, nameAvail - estLogoW - 6);
    const logoH = Math.floor(nameSize * 1.15);
    const baseW = measureWidth("title", baseName, nameSize);
    lines.push(`  <text x="30" y="${nameY}" font-family="${FONT_TITLE}" font-size="${nameSize}" font-weight="900" fill="white" style="paint-order:stroke fill" stroke="#000" stroke-width="2.5" stroke-linejoin="round" filter="url(#title-shadow)">${baseEscaped}</text>`);
    const sx = 30 + baseW + 4;
    const logoY = nameY - logoH + Math.floor(logoH * 0.12);
    const [logoSvg] = renderSuffixLogo("VSTAR", sx, logoY, logoH, "url(#title-shadow)");
    lines.push(`  ${logoSvg}`);
  } else {
    const nameSize = fitNameSize(name, 48, CARD_W - 60);
    lines.push(`  <text x="30" y="${nameY}" font-family="${FONT_TITLE}" font-size="${nameSize}" font-weight="900" fill="white" style="paint-order:stroke fill" stroke="#000" stroke-width="2.5" stroke-linejoin="round" filter="url(#title-shadow)">${name}</text>`);
  }

  if (evolveFrom) {
    const stageLine = stage || "VSTAR";
    const evolveLine = `${stageLine} — Evolves from ${evolveFrom}`;
    lines.push(`  <text x="30" y="88" font-family="${FONT_BODY}" font-size="22" font-weight="600" fill="rgba(255,255,255,0.7)" font-style="italic" filter="url(#shadow)">${escapeXml(evolveLine)}</text>`);
  }

  // ── Text content (packed toward bottom) ──
  let y = actualOverlayTop + textPad + Math.floor(BODY_SIZE * 0.5);

  // ── Regular attacks FIRST (before VSTAR Power — VSTAR layout) ──
  for (const atk of regularAttacks) {
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

    const atkDotR = Math.max(10, Math.floor(HEAD_SIZE * 0.48));
    let dotX = MARGIN;
    if (atk.cost.length) {
      const [dotElems, dotW] = renderEnergyDots(MARGIN, barCenterY, atk.cost, atkDotR);
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
      for (let i = 0; i < wrapped.length; i++) {
        y += LINE_H;
        const justify = i < wrapped.length - 1 ? textMaxW : undefined;
        renderTextLineWithEnergy(lines, wrapped[i], MARGIN, y, BODY_SIZE, FONT_BODY, "white", ' filter="url(#shadow)"', justify, energyPalette);
      }
    }
    y += Math.floor(BODY_SIZE * 1.25);
  }

  // ── VSTAR Power section (attacks or abilities, rendered BELOW regular attacks) ──
  for (const vp of vstarPowers) {
    const barH = Math.floor(HEAD_SIZE * 1.5);
    const barY = y - Math.floor(HEAD_SIZE * 1.07);
    const barCenterY = barY + Math.floor(barH / 2);

    // Type-colored bar with thin gold left accent
    lines.push(`  <line x1="20" y1="${barY}" x2="${CARD_W - 20}" y2="${barY}" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>`);
    lines.push(`  <rect x="20" y="${barY}" width="${CARD_W - 40}" height="${barH}" rx="6" fill="${color}" opacity="0.35"/>`);
    lines.push(`  <rect x="20" y="${barY}" width="3" height="${barH}" rx="1" fill="#DAA520" opacity="0.8"/>`);

    // "VSTAR Power" label (small, gold) — with energy dots + damage for attack-type powers
    const labelSize = Math.floor(HEAD_SIZE * 0.6);
    const labelY = barY + Math.floor(barH * 0.38);
    lines.push(`  <text x="${MARGIN}" y="${labelY}" font-family="${FONT_TITLE}" font-size="${labelSize}" font-weight="700" fill="#DAA520" dominant-baseline="central" filter="url(#shadow)">VSTAR Power</text>`);

    // Ability/attack name line (with energy dots and damage if it's an attack)
    const nameLineY = barY + Math.floor(barH * 0.75);
    if (vp.cost?.length) {
      const atkDotR = Math.max(10, Math.floor(HEAD_SIZE * 0.48));
      const [dotElems, dotW] = renderEnergyDots(MARGIN, nameLineY, vp.cost, atkDotR);
      lines.push(...dotElems);
      const dotX = MARGIN + dotW + 6;
      const vpNameSize = fitAbilityHeader(vp.name, HEAD_SIZE, CARD_W - dotX - MARGIN - (vp.damage ? 80 : 10));
      lines.push(`  <text x="${dotX}" y="${nameLineY}" font-family="${FONT_TITLE}" font-size="${vpNameSize}" font-weight="900" fill="white" dominant-baseline="central" style="paint-order:stroke fill" stroke="rgba(0,0,0,0.4)" stroke-width="2" stroke-linejoin="round" filter="url(#shadow)">${escapeXml(vp.name)}</text>`);
      if (vp.damage) {
        const dmgSize = Math.floor(HEAD_SIZE * 1.1);
        lines.push(`  <text x="${CARD_W - MARGIN}" y="${nameLineY - 2}" font-family="${FONT_TITLE}" font-size="${dmgSize}" font-weight="900" fill="#FF5533" text-anchor="end" dominant-baseline="central" style="paint-order:stroke fill" stroke="#000" stroke-width="2" stroke-linejoin="round" filter="url(#dmg-shadow)">${escapeXml(String(vp.damage))}</text>`);
      }
    } else {
      const vpNameSize = fitAbilityHeader(vp.name, HEAD_SIZE, CARD_W - 2 * MARGIN - 10);
      lines.push(`  <text x="${MARGIN}" y="${nameLineY}" font-family="${FONT_TITLE}" font-size="${vpNameSize}" font-weight="900" fill="white" dominant-baseline="central" style="paint-order:stroke fill" stroke="rgba(0,0,0,0.4)" stroke-width="2" stroke-linejoin="round" filter="url(#shadow)">${escapeXml(vp.name)}</text>`);
    }
    y += Math.floor(HEAD_SIZE * 0.5);

    const cleanEffect = stripOncePerGame(vp.effect);

    if (cleanEffect) {
      const wrapped = ftWrap("body", cleanEffect, BODY_SIZE, textMaxW);
      for (let i = 0; i < wrapped.length; i++) {
        y += LINE_H;
        const justify = i < wrapped.length - 1 ? textMaxW : undefined;
        renderTextLineWithEnergy(lines, wrapped[i], MARGIN, y, BODY_SIZE, FONT_BODY, "white", ' filter="url(#shadow)"', justify, energyPalette);
      }
    }

    y += Math.floor(BODY_SIZE * 0.5);
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

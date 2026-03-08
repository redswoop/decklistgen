/**
 * Renders an SVG preview strip showing all 11 energy type icons
 * with their inline font glyphs and labels, in two palette contexts:
 * dark (for standard cards) and light (for full-art cards).
 */

import { getFontStyle, renderTypeIcon, resetIconIds } from "./type-icons.js";
import type { EnergyPalette } from "./constants.js";
import { getDarkPalette, getLightPalette } from "./energy-palette-store.js";

const ENERGY_TYPES: readonly { name: string; letter: string }[] = [
  { name: "Grass", letter: "G" },
  { name: "Fire", letter: "R" },
  { name: "Water", letter: "W" },
  { name: "Lightning", letter: "L" },
  { name: "Psychic", letter: "P" },
  { name: "Fighting", letter: "F" },
  { name: "Darkness", letter: "D" },
  { name: "Metal", letter: "M" },
  { name: "Fairy", letter: "Y" },
  { name: "Dragon", letter: "N" },
  { name: "Colorless", letter: "C" },
];

function renderSection(
  palette: EnergyPalette,
  offsetY: number,
  labelFill: string,
): string {
  const count = ENERGY_TYPES.length;
  const iconRadius = 24;
  const spacing = 72;
  const padX = 40;
  const glyphSize = 28;
  const labelSize = 11;

  const iconCy = offsetY + iconRadius;
  const glyphY = iconCy + iconRadius + 8 + glyphSize;
  const labelY = glyphY + 16;

  return ENERGY_TYPES.map((t, i) => {
    const cx = padX + i * spacing;
    const color = palette[t.letter] ?? "#888";

    const icon = renderTypeIcon(cx, iconCy, iconRadius, t.name);

    let glyph: string;
    if (t.letter === "N") {
      glyph =
        `<text x="${cx}" y="${glyphY}" text-anchor="middle" dominant-baseline="central" ` +
        `fill="${color}" font-size="${glyphSize}">&#x25CF;</text>`;
    } else {
      glyph =
        `<text x="${cx}" y="${glyphY}" font-family="EssentiarumTCG" text-anchor="middle" ` +
        `dominant-baseline="central" fill="${color}" font-size="${glyphSize}">${t.letter}</text>`;
    }

    const label =
      `<text x="${cx}" y="${labelY}" font-family="Helvetica, Arial, sans-serif" ` +
      `font-size="${labelSize}" fill="${labelFill}" text-anchor="middle">${t.name}</text>`;

    return icon + glyph + label;
  }).join("\n");
}

export function renderEnergyPreviewSvg(): string {
  resetIconIds();

  const count = ENERGY_TYPES.length;
  const spacing = 72;
  const padX = 40;
  const padY = 14;
  const sectionH = 110;
  const sectionGap = 16;
  const titleSize = 14;

  const width = padX * 2 + (count - 1) * spacing;
  const height = padY + titleSize + 4 + sectionH + sectionGap + titleSize + 4 + sectionH + padY;

  const parts: string[] = [];

  // Section 1: Standard (dark palette on light background)
  const s1TitleY = padY + titleSize;
  const s1Top = s1TitleY + 4;
  parts.push(`<rect x="0" y="${s1Top}" width="${width}" height="${sectionH}" rx="8" fill="#f5f5f5"/>`);
  parts.push(`<text x="${padX}" y="${s1TitleY}" font-family="Helvetica, Arial, sans-serif" font-size="${titleSize}" font-weight="700" fill="#333">Standard</text>`);
  parts.push(renderSection(getDarkPalette(), s1Top + 4, "#666"));

  // Section 2: Full-art (light palette on dark background)
  const s2TitleY = s1Top + sectionH + sectionGap + titleSize;
  const s2Top = s2TitleY + 4;
  parts.push(`<rect x="0" y="${s2Top}" width="${width}" height="${sectionH}" rx="8" fill="#1a1a2e"/>`);
  parts.push(`<text x="${padX}" y="${s2TitleY}" font-family="Helvetica, Arial, sans-serif" font-size="${titleSize}" font-weight="700" fill="#333">Full-art</text>`);
  parts.push(renderSection(getLightPalette(), s2Top + 4, "#aaa"));

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">` +
    `<defs>${getFontStyle()}</defs>` +
    parts.join("\n") +
    `</svg>`
  );
}

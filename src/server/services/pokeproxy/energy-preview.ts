/**
 * Renders an SVG preview strip showing all 11 energy type icons
 * with their inline font glyphs and labels.
 */

import { getFontStyle, renderTypeIcon, resetIconIds } from "./type-icons.js";
import { ENERGY_COLORS } from "./constants.js";

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

export function renderEnergyPreviewSvg(): string {
  resetIconIds();

  const count = ENERGY_TYPES.length;
  const iconRadius = 24;
  const spacing = 72;
  const padX = 40;
  const padY = 14;
  const labelSize = 11;
  const glyphSize = 28;

  const width = padX * 2 + (count - 1) * spacing;

  // Row 1: icon circles
  const iconCy = padY + iconRadius;
  // Row 2: inline font glyphs
  const glyphY = iconCy + iconRadius + 8 + glyphSize;
  // Row 3: label
  const labelY = glyphY + 16;
  const height = labelY + padY;

  const columns = ENERGY_TYPES.map((t, i) => {
    const cx = padX + i * spacing;
    const color = ENERGY_COLORS[t.letter] ?? "#888";

    // Icon circle
    const icon = renderTypeIcon(cx, iconCy, iconRadius, t.name);

    // Inline font glyph (same rendering as card text)
    let glyph: string;
    if (t.letter === "N") {
      // Dragon uses a filled circle since 'N' renders "LEGEND" in the font
      glyph =
        `<text x="${cx}" y="${glyphY}" text-anchor="middle" dominant-baseline="central" ` +
        `fill="${color}" font-size="${glyphSize}">&#x25CF;</text>`;
    } else {
      glyph =
        `<text x="${cx}" y="${glyphY}" font-family="EssentiarumTCG" text-anchor="middle" ` +
        `dominant-baseline="central" fill="${color}" font-size="${glyphSize}">${t.letter}</text>`;
    }

    // Label
    const label =
      `<text x="${cx}" y="${labelY}" font-family="Helvetica, Arial, sans-serif" ` +
      `font-size="${labelSize}" fill="#999" text-anchor="middle">${t.name}</text>`;

    return icon + glyph + label;
  }).join("\n");

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">` +
    `<defs>${getFontStyle()}</defs>` +
    columns +
    `</svg>`
  );
}

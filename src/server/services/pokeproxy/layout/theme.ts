/** Theme factories — map node roles to visual styles. */

import type { Theme } from "./types.js";
import { getDarkPalette } from "../energy-palette-store.js";
import { getFontStyle } from "../type-icons.js";

export function standardTheme(color: string): Theme {
  const fontStyle = getFontStyle();

  return {
    defs: [
      fontStyle,
      `<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0%" stop-color="${color}" stop-opacity="0.3"/>` +
        `<stop offset="100%" stop-color="${color}" stop-opacity="0.1"/>` +
      `</linearGradient>`,
      '<filter id="shadow" x="-2%" y="-2%" width="104%" height="104%">' +
        '<feDropShadow dx="1" dy="1" stdDeviation="0.8" flood-color="#000" flood-opacity="0.35"/>' +
      '</filter>',
      '<filter id="shadow-title" x="-2%" y="-5%" width="104%" height="110%">' +
        '<feDropShadow dx="1.5" dy="2" stdDeviation="1" flood-color="#000" flood-opacity="0.5"/>' +
      '</filter>',
      '<filter id="tag-outline" x="-8%" y="-20%" width="116%" height="140%">' +
        '<feMorphology in="SourceAlpha" operator="dilate" radius="4" result="outer"/>' +
        '<feFlood flood-color="#000" flood-opacity="0.8" result="black"/>' +
        '<feComposite in="black" in2="outer" operator="in" result="outer-stroke"/>' +
        '<feMorphology in="SourceAlpha" operator="dilate" radius="2" result="inner"/>' +
        '<feFlood flood-color="white" flood-opacity="0.95" result="white"/>' +
        '<feComposite in="white" in2="inner" operator="in" result="inner-stroke"/>' +
        '<feMerge>' +
          '<feMergeNode in="outer-stroke"/>' +
          '<feMergeNode in="inner-stroke"/>' +
          '<feMergeNode in="SourceGraphic"/>' +
        '</feMerge>' +
      '</filter>',
    ],

    background: {
      fills: [
        { fill: "white", rx: 25 },
        { fill: "url(#bg)", rx: 25, stroke: color, strokeWidth: 4 },
      ],
    },

    box: {
      "header": { fill: color, opacity: 0.85, rx: 25 },
      "header-bottom": { fill: color, opacity: 0.85 },
      "ability-bar": { fill: color, opacity: 0.18, rx: 5 },
      "attack-bar": { fill: "#333", opacity: 0.1, rx: 5 },
      "footer-divider": { fill: "#444", opacity: 0.4 },
    },

    text: {
      "card-name": { fill: "white", filter: "url(#shadow-title)", fontWeight: "900" },
      "hp-label": { fill: "white", filter: "url(#shadow-title)", fontWeight: "900" },
      "hp-value": { fill: "white", filter: "url(#shadow-title)", fontWeight: "900" },
      "subtitle": { fill: "#444", filter: "url(#shadow)", fontWeight: "700" },
      "ability-label": { fill: color, filter: "url(#shadow)", fontWeight: "900" },
      "attack-name": { fill: "#222", filter: "url(#shadow)", fontWeight: "900" },
      "damage": { fill: "#c00", filter: "url(#shadow)", fontWeight: "900" },
      "body-text": { fill: "#222", filter: "url(#shadow)", fontWeight: "700" },
      "footer-value": { fill: "#444", filter: "url(#shadow)", fontWeight: "700" },
      "rule-text": { fill: "#999", fontWeight: "600" },
      "set-info": { fill: "#777", fontWeight: "600" },
      "trainer-icon": { fill: "#FFD040", filter: "url(#tag-outline)", fontWeight: "900" },
    },

    line: {
      "attack-sep": { stroke: "rgba(0,0,0,0.08)", strokeWidth: 1 },
      "footer-sep": { stroke: "#ccc", strokeWidth: 1 },
    },

    energyPalette: getDarkPalette(),

    footer: {
      fill: "#444",
      retreatDotFill: "#ddd",
      infoFill: "#777",
      sepColor: "#ccc",
    },
  };
}

/**
 * Tree builder for standard card template.
 * Pokemon-specific knowledge lives here — the resolver and emitter are game-agnostic.
 *
 * Layer 1 (primitives): box(), text(), icon(), row() etc. — in helpers.ts
 * Layer 2 (builders): Small focused functions that return subtrees — this file
 * Template: buildStandardTree() composes builders into the full card tree.
 */

import type { BoxNode, LayoutNode } from "./types.js";
import { box, row, column, text, icon, image, line, shape, logo, spacer, gap } from "./helpers.js";
import { CARD_W, CARD_H, MARGIN, POKEMON_RULES, TRAINER_RULES,
  ART_TOP, ART_BOTTOM, ART_LEFT, ART_RIGHT, TYPE_MATCHUPS } from "../constants.js";
import { escapeXml, fitAbilityHeader } from "../svg-helpers.js";
import { ftWrap, fitAttackHeader, fitNameSize } from "../text.js";
import { renderSuffixLogo } from "../logos.js";
import type { CardProps } from "../templates/types.js";

const ART_PAD = 40;
const textMaxW = CARD_W - 2 * MARGIN;

// ── Convenience type for solved sizes ──

interface Sizes {
  bodySize: number;
  headSize: number;
  lineH: number;
  artHeight: number;
}

function solvedSizes(layout: CardProps["layout"]): Sizes {
  return {
    bodySize: layout.bodySize,
    headSize: layout.headSize,
    lineH: layout.lineH,
    artHeight: layout.artHeight ?? 300,
  };
}

// ── Template ──

/** Build the layout tree for a standard (white background) card. */
export function buildStandardTree(props: CardProps): BoxNode {
  const sizes = solvedSizes(props.layout);

  return column({ width: CARD_W, height: CARD_H }, [
    header(props),
    ...(props.category !== "Trainer" ? [subtitle(props)] : []),
    artwork(sizes.artHeight),
    gap(ART_PAD),
    ...effects(props, sizes),
    ...abilities(props.abilities, sizes),
    ...attacks(props.attacks, sizes),
    ...rules(props),
    spacer(),
    footer(props, sizes),
  ]);
}

// ── Header variants ──

function header(props: CardProps): BoxNode {
  if (props.category === "Trainer") return trainerHeader(props);
  if (props.nameSuffix === "ex") return exHeader(props);
  if (props.nameSuffix === "V") return vHeader(props);
  return pokemonHeader(props);
}

const HP_SIZE = 38;
const HP_LABEL_SIZE = Math.round(HP_SIZE * 0.5);

function pokemonHeader(props: CardProps): BoxNode {
  const nameAvail = CARD_W - 30 - 140 - 20;
  const nameSize = fitNameSize(props.name, 42, nameAvail);

  return headerRow([
    text({ role: "card-name", content: props.rawName, fontSize: nameSize, font: "title" }),
    spacer(),
    ...hpNodes(props),
  ]);
}

function exHeader(props: CardProps): BoxNode {
  const logoH = Math.floor(42 * 0.9);
  const [, logoW] = renderSuffixLogo("ex", 0, 0, logoH);
  const nameAvail = CARD_W - 30 - 140 - 20 - logoW - 4;
  const nameSize = fitNameSize(escapeXml(props.baseName), 42, nameAvail);

  return headerRow([
    text({ role: "card-name", content: props.baseName, fontSize: nameSize, font: "title" }),
    logo("ex", logoH),
    spacer(),
    ...hpNodes(props),
  ]);
}

function vHeader(props: CardProps): BoxNode {
  const logoH = Math.floor(42 * 0.9);
  const [, logoW] = renderSuffixLogo("V", 0, 0, logoH);
  const nameAvail = CARD_W - 30 - 140 - 20 - logoW - 4;
  const nameSize = fitNameSize(escapeXml(props.baseName), 42, nameAvail);

  return headerRow([
    text({ role: "card-name", content: props.baseName, fontSize: nameSize, font: "title" }),
    logo("V", logoH),
    spacer(),
    ...hpNodes(props),
  ]);
}

function trainerHeader(props: CardProps): BoxNode {
  const nameAvail = CARD_W - 30 - 70 - 20;
  const nameSize = fitNameSize(props.name, 42, nameAvail);

  return headerRow([
    text({ role: "card-name", content: props.rawName, fontSize: nameSize, font: "title" }),
    spacer(),
    text({ role: "trainer-icon", content: props.trainerType.toUpperCase() || "TRAINER", fontSize: 30, font: "title" }),
  ]);
}

/** Shared header row wrapper — everything shares one baseline. */
function headerRow(children: LayoutNode[]): BoxNode {
  return row({
    role: "header", height: 80,
    padding: { top: 0, right: 30, bottom: 0, left: 30 },
    gap: 4, align: "baseline",
  }, children);
}

/** HP label + number + type icon, flat (no sub-row). */
function hpNodes(props: CardProps): LayoutNode[] {
  if (!props.hp) return [];
  const nodes: LayoutNode[] = [
    text({ role: "hp-label", content: "HP", fontSize: HP_LABEL_SIZE, font: "title" }),
    text({ role: "hp-value", content: String(props.hp), fontSize: HP_SIZE, font: "title" }),
  ];
  if (props.types.length) {
    nodes.push(icon(props.cardType, Math.floor(HP_SIZE * 0.5)));
  }
  return nodes;
}

// ── Subtitle ──

function subtitle(props: CardProps): BoxNode {
  const parts = [props.stage || "Basic"];
  if (props.evolveFrom) parts.push(`Evolves from ${props.evolveFrom}`);
  const typeStr = props.types.join(" / ");
  if (typeStr) parts.push(typeStr);

  return box({ height: 25, padding: { top: 0, right: 0, bottom: 0, left: MARGIN } }, [
    text({ role: "subtitle", content: parts.join(" — "), fontSize: 22, font: "body" }),
  ]);
}

// ── Artwork ──

function artwork(artH: number): BoxNode {
  const srcW = 600, srcH = 825;
  return box({ height: artH, padding: { top: 0, right: 20, bottom: 0, left: 20 } }, [
    image({ crop: { x: ART_LEFT, y: ART_TOP, w: ART_RIGHT - ART_LEFT, h: ART_BOTTOM - ART_TOP, srcW, srcH } }),
  ]);
}

// ── Content block helpers ──

/** Trainer/Energy effect text → LayoutNode[] */
function effects(props: CardProps, sizes: Sizes): LayoutNode[] {
  const { category, trainerEffect } = props;
  if ((category !== "Trainer" && category !== "Energy") || !trainerEffect) return [];

  const wrapped = ftWrap("body", trainerEffect, sizes.bodySize, textMaxW);
  return [
    text({ role: "body-text", content: wrapped.join("\n"), fontSize: sizes.bodySize, font: "body", justify: textMaxW }),
    gap(Math.floor(sizes.bodySize * 0.83)),
  ];
}

/** Ability blocks → LayoutNode[] */
function abilities(abs: CardProps["abilities"], sizes: Sizes): LayoutNode[] {
  const nodes: LayoutNode[] = [];
  for (const ab of abs) {
    nodes.push(...abilityBlock(ab, sizes));
  }
  return nodes;
}

/** Single ability: bar + effect text → LayoutNode[] */
function abilityBlock(ab: CardProps["abilities"][0], sizes: Sizes): LayoutNode[] {
  const barH = Math.floor(sizes.headSize * 1.5);
  const abLabel = `${ab.type}: ${ab.name}`;
  const abLabelSize = fitAbilityHeader(abLabel, sizes.headSize, CARD_W - 2 * MARGIN - 10);

  const nodes: LayoutNode[] = [
    box({ role: "ability-bar", height: barH, padding: { top: 0, right: MARGIN, bottom: 0, left: MARGIN } }, [
      text({ role: "ability-label", content: abLabel, fontSize: abLabelSize, font: "title", dominantBaseline: "central" }),
    ]),
  ];

  if (ab.effect) {
    const wrapped = ftWrap("body", ab.effect, sizes.bodySize, textMaxW);
    nodes.push(gap(Math.floor(sizes.headSize * 0.5)));
    nodes.push(text({ role: "body-text", content: wrapped.join("\n"), fontSize: sizes.bodySize, font: "body", justify: textMaxW }));
  }

  nodes.push(gap(Math.floor(sizes.bodySize * 1.46)));
  return nodes;
}

/** Attack blocks → LayoutNode[] */
function attacks(atks: CardProps["attacks"], sizes: Sizes): LayoutNode[] {
  const nodes: LayoutNode[] = [];
  for (const atk of atks) {
    nodes.push(...attackBlock(atk, sizes));
  }
  return nodes;
}

/** Single attack: separator + cost icons + name + damage + effect → LayoutNode[] */
function attackBlock(atk: CardProps["attacks"][0], sizes: Sizes): LayoutNode[] {
  const barH = Math.floor(sizes.headSize * 1.57);
  const [atkNameSize, atkDmgSize] = fitAttackHeader(atk.name, atk.damage, atk.cost.length, sizes.headSize, CARD_W, MARGIN);

  const attackChildren: LayoutNode[] = [];
  for (const energy of atk.cost) {
    attackChildren.push(icon(energy, Math.max(8, Math.floor(sizes.headSize * 0.45))));
  }
  attackChildren.push(
    text({ role: "attack-name", content: atk.name, fontSize: atkNameSize, font: "title", flex: 1, dominantBaseline: "central" }),
  );
  if (atk.damage) {
    attackChildren.push(
      text({ role: "damage", content: String(atk.damage), fontSize: atkDmgSize, font: "title", anchor: "end", dominantBaseline: "central" }),
    );
  }

  const nodes: LayoutNode[] = [
    line("attack-sep"),
    row({
      role: "attack-bar", height: barH,
      padding: { top: 0, right: MARGIN, bottom: 0, left: MARGIN },
      gap: 4, align: "center",
    }, attackChildren),
  ];

  if (atk.effect) {
    const wrapped = ftWrap("body", atk.effect, sizes.bodySize, textMaxW);
    nodes.push(gap(Math.floor(sizes.headSize * 0.64)));
    nodes.push(text({ role: "body-text", content: wrapped.join("\n"), fontSize: sizes.bodySize, font: "body", justify: textMaxW }));
  }

  nodes.push(gap(Math.floor(sizes.bodySize * 1.25)));
  return nodes;
}

/** Rules text (italic) → LayoutNode[] */
function rules(props: CardProps): LayoutNode[] {
  let ruleText = "";
  if (props.category === "Pokemon" && props.suffix in POKEMON_RULES) ruleText = POKEMON_RULES[props.suffix];
  else if (props.category === "Trainer" && props.trainerType in TRAINER_RULES) ruleText = TRAINER_RULES[props.trainerType];
  if (!ruleText) return [];

  const ruleSize = 16;
  const ruleLines = ftWrap("body", ruleText, ruleSize, textMaxW);
  return [
    gap(4),
    text({ role: "rule-text", content: ruleLines.join("\n"), fontSize: ruleSize, font: "body", fontStyle: "italic" }),
  ];
}

// ── Footer (declarative) ──

function footer(props: CardProps, sizes: Sizes): BoxNode {
  const { card, category, cardType, setName, localId } = props;
  let { retreat } = props;
  const dotR = Math.floor(sizes.bodySize * 0.45);
  const triS = Math.floor(sizes.bodySize * 0.55);

  // Resolve weakness/resistance
  let weakness: Array<{ type: string; value: string }> | null = null;
  let resistance: Array<{ type: string; value: string }> | null = null;

  if (category !== "Trainer" && category !== "Energy") {
    weakness = card.weaknesses as typeof weakness ?? null;
    resistance = card.resistances as typeof resistance ?? null;
    if (cardType in TYPE_MATCHUPS) {
      const [wt, wv, rt, rv] = TYPE_MATCHUPS[cardType];
      if (!weakness && wt) weakness = [{ type: wt, value: wv! }];
      if (!resistance && rt) resistance = [{ type: rt, value: rv! }];
    }
  } else {
    retreat = 0;
  }

  const hasStats = weakness || resistance || retreat;

  // Stats row: weakness, resistance, retreat
  const statsChildren: LayoutNode[] = [];
  if (weakness) {
    for (const w of weakness) {
      statsChildren.push(shape("triangle-down", triS));
      statsChildren.push(icon(w.type, dotR));
      statsChildren.push(text({ role: "footer-value", content: w.value, fontSize: sizes.bodySize, font: "body", dominantBaseline: "central" }));
      statsChildren.push(box({ width: Math.floor(sizes.bodySize * 1.5) }, []));
    }
  }
  if (resistance) {
    for (const r of resistance) {
      statsChildren.push(shape("triangle-up", triS));
      statsChildren.push(icon(r.type, dotR));
      statsChildren.push(text({ role: "footer-value", content: r.value, fontSize: sizes.bodySize, font: "body", dominantBaseline: "central" }));
      statsChildren.push(box({ width: Math.floor(sizes.bodySize * 1.5) }, []));
    }
  }
  if (retreat) {
    if (weakness || resistance) {
      statsChildren.push(box({ role: "footer-divider", width: 1, height: triS * 2 }, []));
      statsChildren.push(box({ width: Math.floor(sizes.bodySize * 0.8) }, []));
    }
    statsChildren.push(shape("arrow-right", triS));
    statsChildren.push(box({ width: 8 }, []));
    for (let i = 0; i < retreat; i++) {
      statsChildren.push(icon("Colorless", dotR));
    }
  }

  const children: LayoutNode[] = [];
  if (hasStats) {
    children.push(line("footer-sep"));
    children.push(
      row({
        role: "footer-stats", height: Math.floor(sizes.bodySize * 2.2),
        padding: { top: 0, right: MARGIN, bottom: 0, left: MARGIN },
        gap: 4, align: "center",
      }, statsChildren),
    );
  }
  children.push(
    text({ role: "set-info", content: `${setName} ${localId}`, fontSize: 20, font: "body", anchor: "middle" }),
  );

  return box({ role: "footer", height: 90 }, children);
}

// ── Shared export for fullart template ──

export { solvedSizes };
export type { Sizes };

/** Build content nodes (shared between standard/fullart). */
export function buildContentNodes(
  props: CardProps,
  bodySize: number, headSize: number, lineH: number,
): LayoutNode[] {
  const sizes: Sizes = { bodySize, headSize, lineH, artHeight: 0 };
  return [
    ...effects(props, sizes),
    ...abilities(props.abilities, sizes),
    ...attacks(props.attacks, sizes),
    ...rules(props),
  ];
}

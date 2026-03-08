/**
 * Template registry — dispatches card rendering to the appropriate template.
 */

import type { CardProps, SolvedLayout, FullartOptions } from "./types.js";
import { prepareCardProps, solveStandardLayout, solveFullartLayout } from "../card-prep.js";
import { render as renderStandard } from "./standard.js";
import { render as renderFullart } from "./fullart.js";
import { render as renderBasicEnergy } from "./basic-energy.js";

export { resetIconIds } from "../type-icons.js";

export type TemplateName = "standard" | "fullart" | "basic-energy";

const TEMPLATES: Record<TemplateName, (props: CardProps) => string> = {
  "standard": renderStandard,
  "fullart": renderFullart,
  "basic-energy": renderBasicEnergy,
};

export function renderFromTemplate(
  templateName: TemplateName,
  card: Record<string, unknown>,
  imageB64: string,
  opts?: FullartOptions,
): string {
  const template = TEMPLATES[templateName];
  if (!template) throw new Error(`Unknown template: ${templateName}`);

  let layout: SolvedLayout;

  if (templateName === "basic-energy") {
    // Basic energy has no text layout to solve
    layout = { bodySize: 24, headSize: 28, lineH: 30 };
  } else if (templateName === "fullart") {
    layout = solveFullartLayout(card, {
      maxCover: opts?.maxCover,
      fontSize: opts?.fontSize,
    });
  } else {
    // Standard: compute artY based on card type
    const category = (card.category as string) ?? "Pokemon";
    const evolveFrom = (card.evolveFrom as string) ?? "";
    let artY: number;
    if (category === "Trainer") {
      artY = 85;
    } else {
      artY = 118;
      if (evolveFrom) artY = 135;
    }
    layout = solveStandardLayout(card, artY);
  }

  const props = prepareCardProps(card, imageB64, layout);
  return template(props);
}

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

export type { CardProps, SolvedLayout, FullartOptions } from "./types.js";

/**
 * Template registry — dispatches card rendering to the appropriate template.
 */

import type { CardProps, SolvedLayout } from "./types.js";
import { prepareCardProps, solveStandardLayout, solveFullartLayout } from "../card-prep.js";
import { render as renderStandard } from "./standard.js";
import { render as renderFullart } from "./fullart.js";
import { render as renderBasicEnergy } from "./basic-energy.js";
import type { FullartOptions } from "../renderer.js";

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

export type { CardProps, SolvedLayout } from "./types.js";

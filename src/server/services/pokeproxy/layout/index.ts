/**
 * Layout engine public API.
 * Renders cards using the declarative layout tree system.
 */

export { resolve } from "./resolve.js";
export { emitSvg } from "./emit-svg.js";
export { standardTheme } from "./theme.js";
export { buildStandardTree } from "./build-standard.js";
export type { LayoutNode, BoxNode, ResolvedNode, Theme } from "./types.js";

import { resolve } from "./resolve.js";
import { emitSvg } from "./emit-svg.js";
import { standardTheme } from "./theme.js";
import { buildStandardTree } from "./build-standard.js";
import { CARD_W, CARD_H } from "../constants.js";
import { prepareCardProps, solveStandardLayout } from "../card-prep.js";
import type { SolvedLayout } from "../templates/types.js";

/**
 * Render a standard card through the layout engine.
 * Independent entry point — does not touch old templates.
 */
export function renderWithLayout(
  card: Record<string, unknown>,
  imageB64: string,
  opts?: { fontSize?: number },
): string {
  const category = (card.category as string) ?? "Pokemon";
  const evolveFrom = (card.evolveFrom as string) ?? "";
  let artY: number;
  if (category === "Trainer") {
    artY = 85;
  } else {
    artY = 118;
    if (evolveFrom) artY = 135;
  }

  const layout = solveStandardLayout(card, artY, opts);
  const props = prepareCardProps(card, imageB64, layout);

  const tree = buildStandardTree(props);
  const theme = standardTheme(props.color);
  const resolved = resolve(tree, CARD_W, CARD_H);

  return emitSvg(resolved, theme, imageB64);
}

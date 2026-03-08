/**
 * PokeProxy SVG renderer — TypeScript port.
 *
 * Replaces the Python subprocess (bridge.py → pokeproxy.py).
 * Direct function calls, no subprocess overhead.
 */

export { generateFullartSvg, generateStandardSvg, generateBasicEnergySvg, generatePrintHtml, resetIconIds } from "./renderer.js";
export type { FullartOptions } from "./renderer.js";
export { compressText } from "./compress.js";
export { renderTypeIcon, getFontStyle } from "./type-icons.js";
export { measureWidth, ftWrap, fitNameSize, getPokemonSuffix } from "./text.js";
export { renderFromTemplate } from "./templates/index.js";
export type { TemplateName, CardProps, SolvedLayout } from "./templates/index.js";

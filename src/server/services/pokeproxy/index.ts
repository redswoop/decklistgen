/**
 * PokeProxy SVG renderer — TypeScript.
 */

export { renderFromTemplate, generatePrintHtml, resetIconIds } from "./templates/index.js";
export type { TemplateName, CardProps, SolvedLayout, FullartOptions } from "./templates/index.js";
export { compressText } from "./compress.js";
export { renderTypeIcon, getFontStyle } from "./type-icons.js";
export { measureWidth, ftWrap, fitNameSize, getPokemonSuffix } from "./text.js";

import type { EditorElement } from "../../shared/types/editor.js";

type GetNodeChildren = (node: EditorElement) => EditorElement[] | undefined;

/** Map SVG DOM child indices to a template path, handling repeater skipping. */
export function svgPathToTemplatePath(
  elementId: string,
  svgIndices: number[],
  elements: EditorElement[],
  getNodeChildren: GetNodeChildren,
): (string | number)[] {
  const templatePath: (string | number)[] = [elementId];
  const rootEl = elements.find(e => e.id === elementId);
  let current = rootEl;
  let i = 0;
  while (i < svgIndices.length) {
    if (!current) break;
    if (current.type === "repeater") {
      // Skip the expanded item index — it's not in the template
      i++;
      if (i < svgIndices.length) {
        const children = getNodeChildren(current);
        const idx = svgIndices[i];
        if (!children || idx >= children.length) break;
        templatePath.push(idx);
        current = children[idx];
      }
      i++;
    } else {
      const idx = svgIndices[i];
      const children = getNodeChildren(current);
      if (!children || idx >= children.length) break;
      templatePath.push(idx);
      current = children[idx];
      i++;
    }
  }
  return templatePath;
}

/** Find SVG DOM elements matching a template path (handles repeater fan-out). */
export function templatePathToSvgTargets(
  path: (string | number)[],
  svgRoot: Element,
  elements: EditorElement[],
  getNodeChildren: GetNodeChildren,
): Element[] {
  const parentG = svgRoot.querySelector(`[data-element-id="${path[0]}"]`);
  if (!parentG) return [];

  let targets: Element[] = [parentG];
  if (path.length <= 1) return targets;

  const rootEl = elements.find(e => e.id === path[0]);
  let svgTarget: Element = parentG;
  let templateNode = rootEl;

  for (let i = 1; i < path.length; i++) {
    const idx = path[i] as number;
    if (!templateNode) break;

    if (templateNode.type === "repeater") {
      // Repeater: find template child across ALL expanded items
      const expandedItems = svgTarget.querySelectorAll(`:scope > g > [data-child-index]`);
      let matches: Element[] = [];
      for (const item of expandedItems) {
        const tc = item.querySelector(`:scope > g > [data-child-index="${idx}"]`);
        if (tc) matches.push(tc);
      }
      if (matches.length > 0) targets = matches;
      const children = getNodeChildren(templateNode);
      templateNode = children?.[idx];
      // Continue drilling into remaining path segments
      for (let j = i + 1; j < path.length; j++) {
        const subIdx = path[j] as number;
        if (!templateNode) break;
        const subMatches: Element[] = [];
        for (const m of matches) {
          const sub = m.querySelector(`:scope > g > [data-child-index="${subIdx}"]`);
          if (sub) subMatches.push(sub);
        }
        if (subMatches.length === 0) break;
        matches = subMatches;
        targets = subMatches;
        const subChildren = getNodeChildren(templateNode);
        templateNode = subChildren?.[subIdx];
      }
      break;
    }

    const childG = svgTarget.querySelector(`:scope > g > [data-child-index="${idx}"]`)
      ?? svgTarget.querySelector(`:scope > [data-child-index="${idx}"]`);
    if (!childG) break;

    svgTarget = childG;
    targets = [childG];

    const children = templateNode.children;
    templateNode = children?.[idx];
  }

  return targets;
}

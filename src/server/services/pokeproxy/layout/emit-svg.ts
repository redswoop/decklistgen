/**
 * SVG emitter — walks a resolved layout tree and produces SVG markup.
 * Game-agnostic: uses Theme for styling, delegates to existing icon/logo renderers.
 */

import type { ResolvedNode, Theme, BoxNode, TextNode, BoxStyle, TextStyle } from "./types.js";
import { CARD_W, CARD_H, FONT_TITLE, FONT_BODY, TYPE_MATCHUPS, MARGIN } from "../constants.js";
import { renderTypeIcon } from "../type-icons.js";
import { renderSuffixLogo } from "../logos.js";
import { escapeXml, renderTextLineWithEnergy } from "../svg-helpers.js";
import { ftWrap } from "../text.js";

export function emitSvg(resolved: ResolvedNode, theme: Theme, imageB64: string): string {
  const lines: string[] = [];

  // SVG open
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CARD_W} ${CARD_H}" width="${CARD_W}" height="${CARD_H}">`);

  // Defs
  lines.push("  <defs>");
  for (const def of theme.defs) {
    lines.push(`    ${def}`);
  }
  lines.push("  </defs>");

  // Background
  for (const bg of theme.background.fills) {
    const attrs: string[] = [`width="${CARD_W}"`, `height="${CARD_H}"`];
    if (bg.rx) attrs.push(`rx="${bg.rx}" ry="${bg.rx}"`);
    attrs.push(`fill="${bg.fill}"`);
    if (bg.opacity != null) attrs.push(`opacity="${bg.opacity}"`);
    if (bg.stroke) attrs.push(`stroke="${bg.stroke}" stroke-width="${bg.strokeWidth ?? 1}"`);
    lines.push(`  <rect ${attrs.join(" ")}/>`);
  }

  // Walk tree
  emitNode(resolved, lines, theme, imageB64);

  lines.push("</svg>");
  return lines.join("\n");
}

function emitNode(rn: ResolvedNode, lines: string[], theme: Theme, imageB64: string): void {
  const node = rn.node;

  switch (node.type) {
    case "box":
      emitBox(rn, lines, theme, imageB64);
      break;
    case "text":
      emitText(rn, lines, theme);
      break;
    case "icon":
      lines.push(`  ${renderTypeIcon(
        Math.floor(rn.x + rn.width / 2),
        Math.floor(rn.y + rn.height / 2),
        node.radius,
        node.iconType,
      )}`);
      break;
    case "image":
      emitImage(rn, lines, imageB64);
      break;
    case "line":
      emitLine(rn, lines, theme);
      break;
    case "shape":
      emitShape(rn, lines, theme);
      break;
    case "logo":
      emitLogo(rn, lines, theme);
      break;
  }
}

function emitBox(rn: ResolvedNode, lines: string[], theme: Theme, imageB64: string): void {
  const box = rn.node as BoxNode;
  if (box.role && theme.box[box.role]) {
    const style = theme.box[box.role];
    emitBoxRect(rn.x, rn.y, rn.width, rn.height, style, lines);

    // Header gets a second rect for the bottom portion (squared corners)
    if (box.role === "header") {
      const bottomH = Math.floor(rn.height / 2);
      emitBoxRect(rn.x, rn.y + rn.height - bottomH, rn.width, bottomH,
        theme.box["header-bottom"] ?? style, lines);
    }
  }

  if (rn.children) {
    for (const child of rn.children) {
      emitNode(child, lines, theme, imageB64);
    }
  }
}

function emitBoxRect(x: number, y: number, w: number, h: number, style: BoxStyle, lines: string[]): void {
  const attrs: string[] = [
    `x="${x}" y="${y}" width="${w}" height="${h}"`,
  ];
  if (style.rx) attrs.push(`rx="${style.rx}" ry="${style.rx}"`);
  attrs.push(`fill="${style.fill ?? "none"}"`);
  if (style.opacity != null) attrs.push(`opacity="${style.opacity}"`);
  if (style.stroke) attrs.push(`stroke="${style.stroke}" stroke-width="${style.strokeWidth ?? 1}"`);
  lines.push(`  <rect ${attrs.join(" ")}/>`);
}

function emitText(rn: ResolvedNode, lines: string[], theme: Theme): void {
  const node = rn.node as TextNode;
  const style: TextStyle = (node.role && theme.text[node.role])
    ? theme.text[node.role]
    : { fill: "#222", fontWeight: "700" };

  const fontFamily = node.font === "title" ? FONT_TITLE : FONT_BODY;
  const anchor = node.anchor ?? "start";

  let textX = rn.x;
  if (anchor === "middle") textX = rn.x + Math.floor(rn.width / 2);
  else if (anchor === "end") textX = rn.x + rn.width;

  // Y position: baseline at bottom of text bounding box
  const textY = rn.y + Math.floor(rn.height * 0.8);

  // Check if this is a multi-line wrapped text node
  if (node.role === "body-text" || node.role === "rule-text") {
    emitWrappedText(rn, lines, theme, node, style, fontFamily, textX);
    return;
  }

  const filterAttr = style.filter ? ` filter="${style.filter}"` : "";
  const anchorAttr = anchor !== "start" ? ` text-anchor="${anchor}"` : "";
  const styleAttr = style.paintOrder ? ` style="paint-order:${style.paintOrder}"` : "";
  const strokeAttr = style.stroke ? ` stroke="${style.stroke}" stroke-width="${style.strokeWidth ?? 1}"` : "";
  const fontStyleAttr = node.fontStyle ? ` font-style="${node.fontStyle}"` : "";
  const dbAttr = node.dominantBaseline ? ` dominant-baseline="${node.dominantBaseline}"` : "";

  // Use dominant-baseline="central" when specified (for vertically centered text in rows)
  const yPos = node.dominantBaseline === "central"
    ? rn.y + Math.floor(rn.height / 2)
    : textY;

  // Energy glyphs in body text
  if (node.content.includes("{") && theme.energyPalette) {
    const justifyWidth = node.justify;
    renderTextLineWithEnergy(
      lines, node.content, textX, yPos, node.fontSize, fontFamily,
      style.fill, filterAttr, justifyWidth, theme.energyPalette,
    );
    return;
  }

  lines.push(
    `  <text x="${textX}" y="${yPos}" font-family="${fontFamily}" font-size="${node.fontSize}"` +
    ` font-weight="${style.fontWeight ?? "700"}" fill="${style.fill}"` +
    `${filterAttr}${anchorAttr}${styleAttr}${strokeAttr}${fontStyleAttr}${dbAttr}>${escapeXml(node.content)}</text>`,
  );
}

function emitWrappedText(
  rn: ResolvedNode, lines: string[], theme: Theme,
  node: TextNode, style: TextStyle, fontFamily: string, textX: number,
): void {
  const filterAttr = style.filter ? ` filter="${style.filter}"` : "";
  const fontStyleAttr = node.fontStyle ? ` font-style="${node.fontStyle}"` : "";

  if (node.role === "rule-text") {
    // Rules text: pre-wrapped lines stored as newline-separated content
    const ruleLines = node.content.split("\n");
    let y = rn.y;
    for (const rl of ruleLines) {
      lines.push(
        `  <text x="${textX}" y="${y}" font-family="${fontFamily}" font-size="${node.fontSize}"` +
        ` font-weight="${style.fontWeight ?? "600"}" fill="${style.fill}"${fontStyleAttr}>${escapeXml(rl)}</text>`,
      );
      y += Math.floor(node.fontSize * 1.3);
    }
    return;
  }

  // Body text: pre-wrapped, may contain energy glyphs
  const wrappedLines = node.content.split("\n");
  let y = rn.y;
  for (let i = 0; i < wrappedLines.length; i++) {
    const justify = i < wrappedLines.length - 1 ? node.justify : undefined;
    renderTextLineWithEnergy(
      lines, wrappedLines[i], textX, y, node.fontSize, fontFamily,
      style.fill, filterAttr, justify, theme.energyPalette,
    );
    y += Math.floor(node.fontSize * 1.25);
  }
}

function emitImage(rn: ResolvedNode, lines: string[], imageB64: string): void {
  const node = rn.node as import("./types.js").ImageNode;
  const x = Math.floor(rn.x);
  const y = Math.floor(rn.y);
  const w = Math.floor(rn.width);
  const h = Math.floor(rn.height);

  if (node.crop) {
    const { x: cx, y: cy, w: cw, h: ch, srcW, srcH } = node.crop;
    // Background placeholder
    lines.push(`  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="#000" opacity="0.05"/>`);
    // Cropped image via nested SVG
    lines.push(`  <svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${cx} ${cy} ${cw} ${ch}" preserveAspectRatio="xMidYMid slice">`);
    lines.push(`    <image width="${srcW}" height="${srcH}" href="data:image/png;base64,${imageB64}"/>`);
    lines.push(`  </svg>`);
    // Border
    lines.push(`  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="none" stroke="rgba(0,0,0,0.12)" stroke-width="1"/>`);
  } else {
    lines.push(`  <image x="${x}" y="${y}" width="${w}" height="${h}" href="data:image/png;base64,${imageB64}"/>`);
  }
}

function emitLine(rn: ResolvedNode, lines: string[], theme: Theme): void {
  const node = rn.node as import("./types.js").LineNode;
  const style = (node.role && theme.line[node.role])
    ? theme.line[node.role]
    : { stroke: "#ccc", strokeWidth: 1 };
  const opacityAttr = style.opacity != null ? ` opacity="${style.opacity}"` : "";
  lines.push(
    `  <line x1="${rn.x}" y1="${rn.y}" x2="${rn.x + rn.width}" y2="${rn.y}"` +
    ` stroke="${style.stroke}" stroke-width="${style.strokeWidth}"${opacityAttr}/>`,
  );
}

function emitShape(rn: ResolvedNode, lines: string[], theme: Theme): void {
  const node = rn.node as import("./types.js").ShapeNode;
  const cx = Math.floor(rn.x + rn.width / 2);
  const cy = Math.floor(rn.y + rn.height / 2);
  const s = node.size;

  switch (node.shape) {
    case "triangle-down":
      lines.push(`  <polygon points="${cx - s},${cy - s} ${cx + s},${cy - s} ${cx},${cy + s}" fill="${theme.footer.fill}" filter="url(#shadow)"/>`);
      break;
    case "triangle-up":
      lines.push(`  <polygon points="${cx},${cy - s} ${cx + s},${cy + s} ${cx - s},${cy + s}" fill="${theme.footer.fill}" filter="url(#shadow)"/>`);
      break;
    case "arrow-right": {
      lines.push(`  <polygon points="${cx - s},${cy} ${cx},${cy - s} ${cx},${cy + s}" fill="${theme.footer.fill}" filter="url(#shadow)"/>`);
      lines.push(`  <line x1="${cx}" y1="${cy}" x2="${cx + s}" y2="${cy}" stroke="${theme.footer.fill}" stroke-width="3" filter="url(#shadow)"/>`);
      break;
    }
  }
}

function emitLogo(rn: ResolvedNode, lines: string[], theme: Theme): void {
  const node = rn.node as import("./types.js").LogoNode;
  const filterAttr = theme.text["card-name"]?.filter ? `${theme.text["card-name"].filter}` : undefined;
  const [svg] = renderSuffixLogo(node.logoKey, rn.x, rn.y, node.height, filterAttr);
  if (svg) lines.push(`  ${svg}`);
}

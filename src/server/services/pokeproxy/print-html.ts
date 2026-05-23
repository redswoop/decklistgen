/**
 * Generates a printable HTML page from SVG card content.
 */

export type PrintPaper = "letter" | "super-b";
export type PrintOrientation = "portrait" | "landscape";

export interface PrintHtmlOptions {
  paper?: PrintPaper;
  orientation?: PrintOrientation;
}

const PAPER_SIZES: Record<PrintPaper, { w: string; h: string }> = {
  letter: { w: "8.5in", h: "11in" },
  "super-b": { w: "13in", h: "19in" },
};

export function generatePrintHtml(
  cards: [number, string][],
  options: PrintHtmlOptions = {},
): string {
  const paper = options.paper ?? "letter";
  const orientation = options.orientation ?? "portrait";
  const { w, h } = PAPER_SIZES[paper];
  const pageSize = orientation === "landscape" ? `${h} ${w}` : `${w} ${h}`;

  const parts: string[] = [];
  parts.push(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>PokeProxy - Print Sheet</title>
<style>
  @page { size: ${pageSize}; margin: 0.25in; }
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

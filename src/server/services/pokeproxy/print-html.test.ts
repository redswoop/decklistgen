import { describe, expect, test } from "bun:test";
import { generatePrintHtml } from "./print-html.js";

const SAMPLE_SVG = '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';

function countMatches(html: string, pattern: RegExp): number {
  return html.match(pattern)?.length ?? 0;
}

describe("generatePrintHtml", () => {
  test("defaults to letter portrait", () => {
    const html = generatePrintHtml([[1, SAMPLE_SVG]]);
    expect(html).toContain("@page { size: 8.5in 11in;");
  });

  test("super-b portrait emits 13x19", () => {
    const html = generatePrintHtml([[1, SAMPLE_SVG]], { paper: "super-b" });
    expect(html).toContain("@page { size: 13in 19in;");
  });

  test("super-b landscape swaps dimensions", () => {
    const html = generatePrintHtml([[1, SAMPLE_SVG]], { paper: "super-b", orientation: "landscape" });
    expect(html).toContain("@page { size: 19in 13in;");
  });

  test("letter landscape swaps dimensions", () => {
    const html = generatePrintHtml([[1, SAMPLE_SVG]], { paper: "letter", orientation: "landscape" });
    expect(html).toContain("@page { size: 11in 8.5in;");
  });

  test("@page margin is 0 so marks have room outside the grid", () => {
    const html = generatePrintHtml([[1, SAMPLE_SVG]]);
    expect(html).toContain("@page { size: 8.5in 11in; margin: 0;");
  });

  test("strips xml declaration and repeats by count", () => {
    const html = generatePrintHtml([[3, SAMPLE_SVG]]);
    expect(html).not.toContain("<?xml");
    expect(countMatches(html, /<div class="card">/g)).toBe(3);
  });

  test("flattens multiple entries", () => {
    const html = generatePrintHtml([
      [2, SAMPLE_SVG],
      [1, SAMPLE_SVG],
    ]);
    expect(countMatches(html, /<div class="card">/g)).toBe(3);
  });

  test("embeds img content for original-art prints", () => {
    const img = '<img src="https://assets.example/card/high.png" alt="Card" />';
    const html = generatePrintHtml([[2, img]]);
    expect(countMatches(html, /<img src="https:\/\/assets\.example\/card\/high\.png"/g)).toBe(2);
    expect(html).toContain(".card img");
    // Cards stretch to the full 2.5×3.5in cell; no letterbox.
    expect(html).toContain("object-fit: fill");
  });

  test("wraps each sheet in its own .page", () => {
    const html = generatePrintHtml([[1, SAMPLE_SVG]]);
    expect(html).toContain('<div class="page">');
    expect(countMatches(html, /<div class="page">/g)).toBe(1);
  });

  test("paginates when card count exceeds cardsPerSheet (letter portrait = 9)", () => {
    // 10 cards on a 3x3 letter layout → 2 pages
    const html = generatePrintHtml([[10, SAMPLE_SVG]]);
    expect(countMatches(html, /<div class="page">/g)).toBe(2);
    expect(countMatches(html, /<div class="card">/g)).toBe(10);
  });

  test("page-break-after: always on .page (except last via :last-child rule)", () => {
    const html = generatePrintHtml([[1, SAMPLE_SVG]]);
    expect(html).toContain("page-break-after: always");
    expect(html).toContain(".page:last-child { page-break-after: auto; }");
  });

  test("emits a crop-marks SVG per page", () => {
    const html = generatePrintHtml([[10, SAMPLE_SVG]]); // 2 pages
    expect(countMatches(html, /<svg class="crop-marks"/g)).toBe(2);
  });

  test("crop marks: letter portrait 3x3 full sheet has 16 lines", () => {
    // Full grid: 4 L-corners × 2 strokes + 2*(cols-1) vert ticks + 2*(rows-1) horiz ticks
    // For 3×3: 8 + 4 + 4 = 16
    const html = generatePrintHtml([[9, SAMPLE_SVG]]);
    expect(countMatches(html, /<line /g)).toBe(16);
  });

  test("crop marks: super-b portrait 5x5 full sheet has 24 lines", () => {
    const html = generatePrintHtml([[25, SAMPLE_SVG]], { paper: "super-b" });
    expect(countMatches(html, /<line /g)).toBe(24);
  });

  test("crop marks: letter landscape 4x2 full sheet has 16 lines", () => {
    const html = generatePrintHtml([[8, SAMPLE_SVG]], { paper: "letter", orientation: "landscape" });
    expect(countMatches(html, /<line /g)).toBe(16);
  });

  test("crop marks: 1 card has 8 lines (just L-corners, no internal ticks)", () => {
    const html = generatePrintHtml([[1, SAMPLE_SVG]]);
    // 1×1 grid → 4 L-corners × 2 strokes = 8 lines; 0 internal lines
    expect(countMatches(html, /<line /g)).toBe(8);
  });

  test("crop marks: partial last page sizes grid to actual content", () => {
    // 6 cards on letter portrait → 3×2 used grid
    // 8 L-corners + 2*(3-1)=4 vert ticks + 2*(2-1)=2 horiz ticks = 14 lines
    const html = generatePrintHtml([[6, SAMPLE_SVG]]);
    expect(countMatches(html, /<line /g)).toBe(14);
    expect(html).toContain("grid-template-rows: repeat(2,");
    // Grid height = 2*3.5 + 1*0.5mm gap → starts with "7.0"
    expect(html).toMatch(/height: 7\.0\d+in/);
  });

  test("includes 0.5mm gap between cards", () => {
    const html = generatePrintHtml([[9, SAMPLE_SVG]]);
    // 0.5mm = 0.5/25.4 ≈ 0.01968in
    expect(html).toMatch(/\.card-grid \{ display: grid; gap: 0\.019\d+in;/);
  });

  test("crop marks: multi-page deck — page 1 full grid, page 2 partial", () => {
    // 10 cards on letter portrait → page 1 has 9 (full 3×3, 16 lines),
    // page 2 has 1 (1×1, 8 lines). Total 24 lines across both pages.
    const html = generatePrintHtml([[10, SAMPLE_SVG]]);
    expect(countMatches(html, /<line /g)).toBe(24);
  });

  test("crop-marks SVG is centered via translate(-50%, -50%)", () => {
    const html = generatePrintHtml([[1, SAMPLE_SVG]]);
    expect(html).toContain("transform: translate(-50%, -50%)");
    expect(html).toContain(".card-grid {");
    expect(html).toContain(".crop-marks {");
  });

  test("renders a single empty page when no cards", () => {
    const html = generatePrintHtml([]);
    expect(countMatches(html, /<div class="page">/g)).toBe(1);
    expect(countMatches(html, /<div class="card">/g)).toBe(0);
    expect(countMatches(html, /<svg class="crop-marks"/g)).toBe(1);
  });
});

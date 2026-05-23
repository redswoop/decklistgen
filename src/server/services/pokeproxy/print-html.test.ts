import { describe, expect, test } from "bun:test";
import { generatePrintHtml } from "./print-html.js";

const SAMPLE_SVG = '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';

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

  test("strips xml declaration and repeats by count", () => {
    const html = generatePrintHtml([[3, SAMPLE_SVG]]);
    expect(html).not.toContain("<?xml");
    expect(html.match(/<div class="card">/g)?.length).toBe(3);
  });

  test("flattens multiple entries", () => {
    const html = generatePrintHtml([
      [2, SAMPLE_SVG],
      [1, SAMPLE_SVG],
    ]);
    expect(html.match(/<div class="card">/g)?.length).toBe(3);
  });
});

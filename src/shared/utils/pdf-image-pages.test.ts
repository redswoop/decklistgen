import { describe, expect, test } from "bun:test";
import { deflateSync } from "node:zlib";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildImagePdf, buildPdf, type PdfImagePage } from "./pdf-image-pages";

const dec = new TextDecoder("latin1");

function page(w: number, h: number, rgb: number[]): PdfImagePage {
  const raw = new Uint8Array(w * h * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = rgb[i % 3];
  return { width: w, height: h, deflated: new Uint8Array(deflateSync(raw)) };
}

const place = { pageWPt: 612, pageHPt: 792, xPt: 36, bottomPt: 35.4772, wPt: 530.16, hPt: 739.2 };

describe("buildImagePdf", () => {
  const pdf = buildImagePdf([page(2, 3, [255, 0, 0]), page(2, 3, [0, 0, 255])], place);
  const text = dec.decode(pdf);

  test("has a header, a binary comment, and a trailer", () => {
    expect(text.startsWith("%PDF-1.4\n%")).toBe(true);
    expect(pdf[10]).toBe(0xe2);
    expect(text.endsWith("%%EOF\n")).toBe(true);
    expect(text).toContain("/Type /Catalog");
  });

  test("declares one page per image with the Letter media box and the placement", () => {
    expect(text.match(/\/Type \/Page /g)?.length).toBe(2);
    expect(text).toContain("/Count 2");
    expect(text).toContain("/MediaBox [0 0 612 792]");
    expect(text.match(/q 530\.16 0 0 739\.2 36 35\.4772 cm \/Im Do Q/g)?.length).toBe(2);
    expect(text).toContain("/Width 2 /Height 3 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode");
  });

  test("xref offsets point at the objects they index", () => {
    const start = Number(text.match(/startxref\n(\d+)\n/)![1]);
    expect(text.slice(start, start + 4)).toBe("xref");
    const rows = text.slice(start).split("\n").slice(2);
    // First object's row is index 1 (row 0 is the free head entry).
    const size = Number(text.match(/\/Size (\d+)/)![1]);
    for (let i = 1; i < size; i++) {
      const off = Number(rows[i].slice(0, 10));
      expect(text.slice(off, off + `${i} 0 obj`.length)).toBe(`${i} 0 obj`);
    }
  });

  test("empty input yields a valid zero-page document", () => {
    const t = dec.decode(buildImagePdf([], place));
    expect(t).toContain("/Kids [] /Count 0");
  });
});

describe("buildPdf", () => {
  const two = buildPdf([
    {
      pageWPt: 936,
      pageHPt: 1368,
      images: [
        { image: page(2, 3, [255, 0, 0]), matrix: [0, -530.16, 739.2, 0, 156.8, 1332] },
        { image: page(2, 3, [0, 0, 255]), matrix: [0, 530.16, -739.2, 0, 779.2, 36] },
      ],
      lines: [{ x1: 0, y1: 684, x2: 936, y2: 684, widthPt: 1.5, dashPt: [12, 6] }],
    },
  ]);
  const text = dec.decode(two);

  test("places several turned images on one page, each under its own name", () => {
    expect(text).toContain("/Count 1");
    expect(text).toContain("/MediaBox [0 0 936 1368]");
    expect(text).toContain("q 0 -530.16 739.2 0 156.8 1332 cm /Im Do Q\nq 0 530.16 -739.2 0 779.2 36 cm /Im2 Do Q");
    expect(text).toMatch(/\/XObject << \/Im \d+ 0 R \/Im2 \d+ 0 R >>/);
    expect(text.match(/\/Subtype \/Image/g)?.length).toBe(2);
  });

  test("strokes guide lines over the images", () => {
    expect(text).toContain("/Im2 Do Q\nq 0 G 1.5 w [12 6] 0 d 0 684 m 936 684 l S Q");
    const solid = dec.decode(buildPdf([{ pageWPt: 10, pageHPt: 10, images: [], lines: [{ x1: 1, y1: 2, x2: 3, y2: 4, widthPt: 0.5 }] }]));
    expect(solid).toContain("q 0 G 0.5 w 1 2 m 3 4 l S Q");
  });

  test("a single upright image writes the same bytes as buildImagePdf", () => {
    const img = page(2, 3, [9, 9, 9]);
    const viaPages = buildPdf([{ pageWPt: 612, pageHPt: 792, images: [{ image: img, matrix: [530.16, 0, 0, 739.2, 36, 35.4772] }] }]);
    expect(viaPages).toEqual(buildImagePdf([img], place));
  });
});

// Independent check with poppler, when present.
const pdfimages = Bun.which("pdfimages");
const pdfinfo = Bun.which("pdfinfo");
describe.skipIf(!pdfimages || !pdfinfo)("poppler", () => {
  test("pdfinfo and pdfimages agree with what we wrote", () => {
    const dir = mkdtempSync(join(tmpdir(), "pdf-image-pages-"));
    const path = join(dir, "t.pdf");
    writeFileSync(path, buildImagePdf([page(2209, 3080, [250, 250, 250])], place));
    const info = Bun.spawnSync([pdfinfo!, path]).stdout.toString();
    expect(info).toMatch(/Pages:\s+1/);
    expect(info).toMatch(/Page size:\s+612 x 792 pts \(letter\)/);
    const list = Bun.spawnSync([pdfimages!, "-list", path]).stdout.toString();
    expect(list).toMatch(/image\s+2209\s+3080\s+rgb\s+3\s+8\s+image\s+no\s+\d+\s+0\s+300\s+300/);
  });
});

/**
 * Minimal PDF writer: full-colour rasters, each placed at an exact position in
 * points (quarter turns allowed), plus plain black guide lines, nothing else. Used for the Cricut print file, where the
 * page must be a pixel-exact 300 dpi image at a known offset and no viewer or
 * driver may be allowed to "help". Pages carry their image already
 * zlib-deflated (the browser's CompressionStream("deflate") produces exactly
 * the stream /FlateDecode expects), so this stays a pure byte assembler that
 * runs the same in bun:test.
 */

export interface PdfImagePage {
  width: number;
  height: number;
  /** zlib-deflated RGB triplets, row-major, 8 bits per sample. */
  deflated: Uint8Array;
}

export interface PdfImagePlacement {
  pageWPt: number;
  pageHPt: number;
  /** Left edge of the image, pt. */
  xPt: number;
  /** Bottom edge of the image, pt (PDF's origin is bottom-left). */
  bottomPt: number;
  wPt: number;
  hPt: number;
}

/** A straight black stroke, pt, PDF coordinates (origin bottom-left). */
export interface PdfLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  widthPt: number;
  /** Dash pattern, on/off; solid when absent. */
  dashPt?: [number, number];
}

/** One printed page holding any number of images, each placed by its own `cm` operands. */
export interface PdfPage {
  pageWPt: number;
  pageHPt: number;
  images: { image: PdfImagePage; matrix: [number, number, number, number, number, number] }[];
  /** Drawn over the images. */
  lines?: PdfLine[];
}

const enc = new TextEncoder();

function bytes(s: string): Uint8Array {
  return enc.encode(s);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(4).replace(/\.?0+$/, ""));

export function buildImagePdf(pages: PdfImagePage[], place: PdfImagePlacement): Uint8Array {
  return buildPdf(
    pages.map((image) => ({
      pageWPt: place.pageWPt,
      pageHPt: place.pageHPt,
      images: [{ image, matrix: [place.wPt, 0, 0, place.hPt, place.xPt, place.bottomPt] }],
    })),
  );
}

export function buildPdf(pages: PdfPage[]): Uint8Array {
  // Object 1 is the page tree; each page adds image, content, page objects.
  const objects: Uint8Array[] = [];
  const add = (body: Uint8Array | Uint8Array[]) => {
    objects.push(Array.isArray(body) ? concat(body) : body);
    return objects.length;
  };
  add(bytes("")); // placeholder for /Pages, filled once the page ids are known
  const pageIds: number[] = [];
  // The first image of a page is /Im, the rest /Im2, /Im3…
  const name = (i: number) => (i === 0 ? "Im" : `Im${i + 1}`);
  for (const pg of pages) {
    const imgs = pg.images.map(({ image }) =>
      add([
        bytes(
          `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} ` +
            `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${image.deflated.length} >>\nstream\n`,
        ),
        image.deflated,
        bytes("\nendstream"),
      ]),
    );
    const content = bytes(
      [
        ...pg.images.map(({ matrix }, i) => `q ${matrix.map(num).join(" ")} cm /${name(i)} Do Q`),
        ...(pg.lines ?? []).map(
          (l) =>
            `q 0 G ${num(l.widthPt)} w ${l.dashPt ? `[${l.dashPt.map(num).join(" ")}] 0 d ` : ""}` +
            `${num(l.x1)} ${num(l.y1)} m ${num(l.x2)} ${num(l.y2)} l S Q`,
        ),
      ].join("\n"),
    );
    const cs = add([bytes(`<< /Length ${content.length} >>\nstream\n`), content, bytes("\nendstream")]);
    pageIds.push(
      add(
        bytes(
          `<< /Type /Page /Parent 1 0 R /MediaBox [0 0 ${num(pg.pageWPt)} ${num(pg.pageHPt)}] ` +
            `/Resources << /XObject << ${imgs.map((id, i) => `/${name(i)} ${id} 0 R`).join(" ")} >> >> /Contents ${cs} 0 R >>`,
        ),
      ),
    );
  }
  objects[0] = bytes(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);
  const catalog = add(bytes("<< /Type /Catalog /Pages 1 0 R >>"));

  // Header, then the conventional binary comment (raw bytes > 127, not UTF-8).
  const parts: Uint8Array[] = [concat([bytes("%PDF-1.4\n%"), new Uint8Array([0xe2, 0xe3, 0xcf, 0xd3]), bytes("\n")])];
  let length = parts[0].length;
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(length);
    const head = bytes(`${i + 1} 0 obj\n`);
    const tail = bytes("\nendobj\n");
    parts.push(head, body, tail);
    length += head.length + body.length + tail.length;
  });
  const xrefAt = length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) xref += `${String(o).padStart(10, "0")} 00000 n \n`;
  xref += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  parts.push(bytes(xref));
  return concat(parts);
}

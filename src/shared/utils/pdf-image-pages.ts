/**
 * Minimal PDF writer: one full-colour raster per page, placed at an exact
 * position in points, nothing else. Used for the Cricut print file, where the
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
  // Object 1 is the page tree; each page adds image, content, page objects.
  const objects: Uint8Array[] = [];
  const add = (body: Uint8Array | Uint8Array[]) => {
    objects.push(Array.isArray(body) ? concat(body) : body);
    return objects.length;
  };
  add(bytes("")); // placeholder for /Pages, filled once the page ids are known
  const pageIds: number[] = [];
  const content = bytes(`q ${num(place.wPt)} 0 0 ${num(place.hPt)} ${num(place.xPt)} ${num(place.bottomPt)} cm /Im Do Q`);
  for (const pg of pages) {
    const img = add([
      bytes(
        `<< /Type /XObject /Subtype /Image /Width ${pg.width} /Height ${pg.height} ` +
          `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${pg.deflated.length} >>\nstream\n`,
      ),
      pg.deflated,
      bytes("\nendstream"),
    ]);
    const cs = add([bytes(`<< /Length ${content.length} >>\nstream\n`), content, bytes("\nendstream")]);
    pageIds.push(
      add(
        bytes(
          `<< /Type /Page /Parent 1 0 R /MediaBox [0 0 ${num(place.pageWPt)} ${num(place.pageHPt)}] ` +
            `/Resources << /XObject << /Im ${img} 0 R >> >> /Contents ${cs} 0 R >>`,
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

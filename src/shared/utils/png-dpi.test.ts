import { describe, expect, test } from "bun:test";
import { withPngDpi, readPngDpi, pngChunk, pHYsChunk, dpiToPixelsPerMetre, isPng } from "./png-dpi.js";

/** Minimal structurally valid PNG: signature, IHDR (1×1 RGBA), IDAT, IEND. */
function tinyPng(extra: Uint8Array[] = []): Uint8Array {
  const sig = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = pngChunk("IHDR", new Uint8Array([0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]));
  // zlib stream for one filtered row of one transparent pixel.
  const idat = pngChunk("IDAT", new Uint8Array([0x78, 0x9c, 0x63, 0x60, 0x00, 0x00, 0x00, 0x06, 0x00, 0x01]));
  const iend = pngChunk("IEND", new Uint8Array(0));
  const parts = [sig, ihdr, ...extra, idat, iend];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

describe("png-dpi", () => {
  test("300 dpi is 11811 pixels per metre", () => {
    expect(dpiToPixelsPerMetre(300)).toBe(11811);
    expect(dpiToPixelsPerMetre(96)).toBe(3780);
  });

  test("pHYs chunk carries the CRC the spec computes", () => {
    const c = pHYsChunk(300);
    // length 9, type pHYs, 9 bytes, CRC
    expect(c.length).toBe(4 + 4 + 9 + 4);
    expect(String.fromCharCode(...c.subarray(4, 8))).toBe("pHYs");
    // Cross-checked with Python: zlib.crc32(b"pHYs" + pack(">IIB", 11811, 11811, 1)).
    expect(Array.from(c.subarray(17, 21))).toEqual([0x78, 0xa5, 0x3f, 0x76]);
  });

  test("inserts pHYs right after IHDR and the result reads back as 300 dpi", () => {
    const src = tinyPng();
    expect(readPngDpi(src)).toBeNull();
    const out = withPngDpi(src, 300);
    expect(isPng(out)).toBe(true);
    expect(readPngDpi(out)).toBe(300);
    // Chunk order: IHDR, pHYs, IDAT, IEND.
    const types: string[] = [];
    let off = 8;
    while (off < out.length) {
      const len = new DataView(out.buffer).getUint32(off);
      types.push(String.fromCharCode(...out.subarray(off + 4, off + 8)));
      off += 12 + len;
    }
    expect(types).toEqual(["IHDR", "pHYs", "IDAT", "IEND"]);
    expect(out.length).toBe(src.length + 21);
  });

  test("replaces an existing pHYs instead of stacking a second one", () => {
    const src = tinyPng([pHYsChunk(72)]);
    expect(readPngDpi(src)).toBe(72);
    const out = withPngDpi(src, 300);
    expect(readPngDpi(out)).toBe(300);
    expect(out.length).toBe(src.length);
  });

  test("rejects non-PNG input", () => {
    expect(() => withPngDpi(new Uint8Array([1, 2, 3]), 300)).toThrow(/not a PNG/);
  });
});

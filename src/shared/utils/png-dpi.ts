/**
 * Stamp a physical resolution (pHYs chunk) into a PNG so importers that honour
 * it — Bambu Suite among them — size the bitmap in real-world units instead of
 * guessing 72 or 96 dpi. Canvas.toBlob() never writes one.
 *
 * Pure byte surgery: locate IHDR, drop any existing pHYs, insert ours right
 * after IHDR (the spec requires it before IDAT). Everything else is copied
 * through untouched.
 */

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const M_PER_IN = 0.0254;

let crcTable: Uint32Array | null = null;
function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function u32(v: number): number[] {
  return [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff];
}

/** Build one PNG chunk: length, type, data, CRC(type+data). */
export function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const body = new Uint8Array(typeBytes.length + data.length);
  body.set(typeBytes, 0);
  body.set(data, typeBytes.length);
  const out = new Uint8Array(4 + body.length + 4);
  out.set(u32(data.length), 0);
  out.set(body, 4);
  out.set(u32(crc32(body)), 4 + body.length);
  return out;
}

/** Pixels per metre for a given dpi, rounded as the chunk stores it. */
export function dpiToPixelsPerMetre(dpi: number): number {
  return Math.round(dpi / M_PER_IN);
}

export function pHYsChunk(dpi: number): Uint8Array {
  const ppm = dpiToPixelsPerMetre(dpi);
  const data = new Uint8Array(9);
  data.set(u32(ppm), 0);
  data.set(u32(ppm), 4);
  data[8] = 1; // unit: metre
  return pngChunk("pHYs", data);
}

interface Chunk {
  type: string;
  start: number; // offset of the length field
  end: number; // offset just past the CRC
}

function readChunks(png: Uint8Array): Chunk[] {
  const chunks: Chunk[] = [];
  let off = PNG_SIGNATURE.length;
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  while (off + 8 <= png.length) {
    const len = view.getUint32(off);
    const type = String.fromCharCode(png[off + 4], png[off + 5], png[off + 6], png[off + 7]);
    const end = off + 12 + len;
    if (end > png.length) throw new Error(`PNG chunk ${type} overruns the buffer`);
    chunks.push({ type, start: off, end });
    off = end;
    if (type === "IEND") break;
  }
  return chunks;
}

export function isPng(bytes: Uint8Array): boolean {
  return PNG_SIGNATURE.every((b, i) => bytes[i] === b);
}

/** Return a copy of `png` carrying a pHYs chunk for `dpi`. */
export function withPngDpi(png: Uint8Array, dpi: number): Uint8Array {
  if (!isPng(png)) throw new Error("not a PNG");
  const chunks = readChunks(png);
  const ihdr = chunks.find((c) => c.type === "IHDR");
  if (!ihdr) throw new Error("PNG has no IHDR");
  const phys = pHYsChunk(dpi);

  const parts: Uint8Array[] = [png.subarray(0, ihdr.end), phys];
  for (const c of chunks) {
    if (c.start < ihdr.end) continue; // signature + IHDR already copied
    if (c.type === "pHYs") continue; // replaced
    parts.push(png.subarray(c.start, c.end));
  }
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

/** Read back the dpi a PNG declares, or null if it has no pHYs in metres. */
export function readPngDpi(png: Uint8Array): number | null {
  if (!isPng(png)) return null;
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  for (const c of readChunks(png)) {
    if (c.type !== "pHYs") continue;
    const ppmX = view.getUint32(c.start + 8);
    const unit = png[c.start + 16];
    if (unit !== 1) return null;
    return Math.round(ppmX * M_PER_IN);
  }
  return null;
}

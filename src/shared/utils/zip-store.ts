import { crc32 } from "./png-dpi.js";

/**
 * Minimal ZIP writer: every entry is *stored* (method 0, no compression). The
 * only payloads we bundle are PNGs, which are already deflated, so a real
 * compressor would cost bytes and a dependency for nothing. Pure byte layout —
 * runs in the browser and in bun:test alike.
 *
 * Layout (PKWARE APPNOTE 4.4.x): local file header + data per entry, then the
 * central directory, then the end-of-central-directory record. Filenames are
 * flagged UTF-8 (general purpose bit 11).
 */

export interface ZipEntry {
  name: string;
  data: Uint8Array;
  mtime?: Date;
}

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;
const VERSION = 20; // 2.0: enough for stored entries
const FLAG_UTF8 = 0x0800;

/** MS-DOS date/time pair as the ZIP headers store it (2-second resolution). */
export function dosDateTime(d: Date): { date: number; time: number } {
  const year = Math.max(1980, d.getFullYear());
  const date = ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  return { date, time };
}

export function buildZip(entries: ZipEntry[], now: Date = new Date()): Uint8Array {
  const enc = new TextEncoder();
  const records = entries.map((e) => {
    const name = enc.encode(e.name);
    if (name.length > 0xffff) throw new Error(`zip entry name too long: ${e.name}`);
    const { date, time } = dosDateTime(e.mtime ?? now);
    return { name, data: e.data, crc: crc32(e.data), date, time, offset: 0 };
  });

  const localSize = records.reduce((n, r) => n + 30 + r.name.length + r.data.length, 0);
  const centralSize = records.reduce((n, r) => n + 46 + r.name.length, 0);
  const out = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(out.buffer);
  let off = 0;

  for (const r of records) {
    r.offset = off;
    view.setUint32(off, SIG_LOCAL, true);
    view.setUint16(off + 4, VERSION, true);
    view.setUint16(off + 6, FLAG_UTF8, true);
    view.setUint16(off + 8, 0, true); // method: stored
    view.setUint16(off + 10, r.time, true);
    view.setUint16(off + 12, r.date, true);
    view.setUint32(off + 14, r.crc, true);
    view.setUint32(off + 18, r.data.length, true);
    view.setUint32(off + 22, r.data.length, true);
    view.setUint16(off + 26, r.name.length, true);
    view.setUint16(off + 28, 0, true); // extra length
    out.set(r.name, off + 30);
    out.set(r.data, off + 30 + r.name.length);
    off += 30 + r.name.length + r.data.length;
  }

  const centralStart = off;
  for (const r of records) {
    view.setUint32(off, SIG_CENTRAL, true);
    view.setUint16(off + 4, VERSION, true); // version made by
    view.setUint16(off + 6, VERSION, true); // version needed
    view.setUint16(off + 8, FLAG_UTF8, true);
    view.setUint16(off + 10, 0, true);
    view.setUint16(off + 12, r.time, true);
    view.setUint16(off + 14, r.date, true);
    view.setUint32(off + 16, r.crc, true);
    view.setUint32(off + 20, r.data.length, true);
    view.setUint32(off + 24, r.data.length, true);
    view.setUint16(off + 28, r.name.length, true);
    view.setUint16(off + 30, 0, true); // extra
    view.setUint16(off + 32, 0, true); // comment
    view.setUint16(off + 34, 0, true); // disk
    view.setUint16(off + 36, 0, true); // internal attrs
    view.setUint32(off + 38, 0, true); // external attrs
    view.setUint32(off + 42, r.offset, true);
    out.set(r.name, off + 46);
    off += 46 + r.name.length;
  }

  view.setUint32(off, SIG_EOCD, true);
  view.setUint16(off + 4, 0, true);
  view.setUint16(off + 6, 0, true);
  view.setUint16(off + 8, records.length, true);
  view.setUint16(off + 10, records.length, true);
  view.setUint32(off + 12, off - centralStart, true);
  view.setUint32(off + 16, centralStart, true);
  view.setUint16(off + 20, 0, true);
  return out;
}

export interface ZipListing {
  name: string;
  size: number;
  crc: number;
  data: Uint8Array;
}

/**
 * Read back a stored-only ZIP (ours, or any archive whose entries are method 0).
 * Walks the central directory; used by tests and the e2e download check.
 */
export function readStoredZip(zip: Uint8Array): ZipListing[] {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  let eocd = zip.length - 22;
  while (eocd >= 0 && view.getUint32(eocd, true) !== SIG_EOCD) eocd--;
  if (eocd < 0) throw new Error("no end-of-central-directory record");
  const count = view.getUint16(eocd + 10, true);
  let off = view.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const out: ZipListing[] = [];
  for (let i = 0; i < count; i++) {
    if (view.getUint32(off, true) !== SIG_CENTRAL) throw new Error("bad central directory entry");
    const method = view.getUint16(off + 10, true);
    if (method !== 0) throw new Error(`entry ${i} is not stored (method ${method})`);
    const crc = view.getUint32(off + 16, true);
    const size = view.getUint32(off + 20, true);
    const nameLen = view.getUint16(off + 28, true);
    const extraLen = view.getUint16(off + 30, true);
    const commentLen = view.getUint16(off + 32, true);
    const local = view.getUint32(off + 42, true);
    const name = dec.decode(zip.subarray(off + 46, off + 46 + nameLen));
    if (view.getUint32(local, true) !== SIG_LOCAL) throw new Error(`bad local header for ${name}`);
    const lNameLen = view.getUint16(local + 26, true);
    const lExtraLen = view.getUint16(local + 28, true);
    const dataStart = local + 30 + lNameLen + lExtraLen;
    out.push({ name, size, crc, data: zip.subarray(dataStart, dataStart + size) });
    off += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

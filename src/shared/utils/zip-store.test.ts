import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildZip, dosDateTime, readStoredZip } from "./zip-store";
import { crc32 } from "./png-dpi";

const enc = new TextEncoder();
const dec = new TextDecoder();

function sample() {
  return buildZip(
    [
      { name: "README.txt", data: enc.encode("hello zip\n") },
      { name: "cards/4x-charizard-ex-sv03-125.png", data: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 3]) },
      { name: "émpty.bin", data: new Uint8Array(0) },
    ],
    new Date(2026, 8, 25, 14, 30, 10),
  );
}

describe("buildZip", () => {
  test("starts with a local header, ends with an EOCD record", () => {
    const zip = sample();
    expect(Array.from(zip.subarray(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(Array.from(zip.subarray(zip.length - 22, zip.length - 18))).toEqual([0x50, 0x4b, 0x05, 0x06]);
  });

  test("total size is the sum of headers, names and data", () => {
    const zip = sample();
    const names = ["README.txt", "cards/4x-charizard-ex-sv03-125.png", "émpty.bin"].map((n) => enc.encode(n).length);
    const data = 10 + 8 + 0;
    const local = names.reduce((n, l) => n + 30 + l, 0) + data;
    const central = names.reduce((n, l) => n + 46 + l, 0);
    expect(zip.length).toBe(local + central + 22);
  });

  test("round-trips names, sizes, CRCs and bytes through the central directory", () => {
    const listing = readStoredZip(sample());
    expect(listing.map((e) => e.name)).toEqual([
      "README.txt",
      "cards/4x-charizard-ex-sv03-125.png",
      "émpty.bin",
    ]);
    expect(dec.decode(listing[0].data)).toBe("hello zip\n");
    expect(listing[0].crc).toBe(crc32(enc.encode("hello zip\n")));
    expect(listing[1].size).toBe(8);
    expect(Array.from(listing[1].data.subarray(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(listing[2].size).toBe(0);
  });

  test("local and central headers agree on the CRC and the stored method", () => {
    const zip = sample();
    const view = new DataView(zip.buffer);
    // First local header: method at +8, crc at +14.
    expect(view.getUint16(8, true)).toBe(0);
    const localCrc = view.getUint32(14, true);
    const [first] = readStoredZip(zip);
    expect(first.crc).toBe(localCrc);
  });

  test("empty archive is just an EOCD record", () => {
    const zip = buildZip([]);
    expect(zip.length).toBe(22);
    expect(readStoredZip(zip)).toEqual([]);
  });

  test("rejects an entry name over 65535 bytes", () => {
    expect(() => buildZip([{ name: "x".repeat(70000), data: new Uint8Array(1) }])).toThrow(/too long/);
  });
});

describe("dosDateTime", () => {
  test("packs the fields at 2-second resolution and clamps years before 1980", () => {
    const { date, time } = dosDateTime(new Date(2026, 8, 25, 14, 30, 11));
    expect(date >> 9).toBe(46); // 2026 - 1980
    expect((date >> 5) & 0xf).toBe(9);
    expect(date & 0x1f).toBe(25);
    expect(time >> 11).toBe(14);
    expect((time >> 5) & 0x3f).toBe(30);
    expect(time & 0x1f).toBe(5); // 11s / 2
    expect(dosDateTime(new Date(1970, 0, 1)).date >> 9).toBe(0);
  });
});

// Independent check: the system unzip must accept the archive verbatim.
const unzip = Bun.which("unzip");
describe.skipIf(!unzip)("system unzip", () => {
  test("unzip -t passes on our archive", () => {
    const dir = mkdtempSync(join(tmpdir(), "zip-store-"));
    const path = join(dir, "sample.zip");
    writeFileSync(path, sample());
    const r = Bun.spawnSync([unzip!, "-t", path]);
    expect(r.exitCode).toBe(0);
    const stdout = r.stdout.toString();
    expect(stdout).toContain("README.txt");
    expect(stdout).toContain("No errors detected");
  });
});

import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { getSvg, peekSvg, clearGallerySvgCache } from "./useGallerySvgCache.js";

const realFetch = globalThis.fetch;

function mockFetch(handler: (url: string) => Response | Promise<Response>) {
  globalThis.fetch = mock(async (input: RequestInfo | URL) =>
    handler(typeof input === "string" ? input : (input as URL).toString())
  ) as unknown as typeof fetch;
}

describe("useGallerySvgCache", () => {
  beforeEach(() => {
    clearGallerySvgCache();
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("fetches the SVG and includes the cacheBust as ?t=", async () => {
    let seenUrl = "";
    mockFetch((url) => {
      seenUrl = url;
      return new Response("<svg>x</svg>", { status: 200 });
    });

    const result = await getSvg("sv01-006", 12345);
    expect(result).toBe("<svg>x</svg>");
    expect(seenUrl).toContain("/api/pokeproxy/svg/sv01-006");
    expect(seenUrl).toContain("t=12345");
  });

  it("returns the same in-flight promise for identical (cardId, cacheBust)", async () => {
    let calls = 0;
    mockFetch(() => {
      calls++;
      return new Response("<svg/>", { status: 200 });
    });

    const a = getSvg("sv01-006", 1);
    const b = getSvg("sv01-006", 1);
    expect(a).toBe(b); // same promise reference
    await Promise.all([a, b]);
    expect(calls).toBe(1);
  });

  it("issues a fresh fetch when cacheBust changes", async () => {
    let calls = 0;
    mockFetch(() => {
      calls++;
      return new Response(`<svg id="r${calls}"/>`, { status: 200 });
    });

    const first = await getSvg("sv01-006", 1);
    const second = await getSvg("sv01-006", 2);
    expect(calls).toBe(2);
    expect(first).toBe('<svg id="r1"/>');
    expect(second).toBe('<svg id="r2"/>');
  });

  it("returns a fallback span string on HTTP error instead of throwing", async () => {
    mockFetch(() => new Response("nope", { status: 500 }));
    const html = await getSvg("missing", 1);
    expect(html).toContain("Failed:");
    expect(html).toContain("HTTP 500");
  });

  it("returns a fallback span string when fetch rejects", async () => {
    mockFetch(() => {
      throw new Error("network down");
    });
    const html = await getSvg("missing", 1);
    expect(html).toContain("Failed:");
    expect(html).toContain("network down");
  });

  it("peekSvg returns undefined for un-cached entries and the promise for cached ones", async () => {
    mockFetch(() => new Response("<svg/>", { status: 200 }));
    expect(peekSvg("sv01-006", 1)).toBeUndefined();
    const p = getSvg("sv01-006", 1);
    expect(peekSvg("sv01-006", 1)).toBe(p);
    await p;
  });

  it("clearGallerySvgCache forces a refetch even with the same cacheBust", async () => {
    let calls = 0;
    mockFetch(() => {
      calls++;
      return new Response("<svg/>", { status: 200 });
    });

    await getSvg("sv01-006", 1);
    clearGallerySvgCache();
    await getSvg("sv01-006", 1);
    expect(calls).toBe(2);
  });
});

import { describe, it, expect } from "bun:test";
import { parsePrintParams, normalizeArtMode, buildJumboPrintUrl } from "./print-params.js";

describe("normalizeArtMode", () => {
  it("recognizes the three modes and defaults to proxy", () => {
    expect(normalizeArtMode("original")).toBe("original");
    expect(normalizeArtMode("cleaned")).toBe("cleaned");
    expect(normalizeArtMode("proxy")).toBe("proxy");
    expect(normalizeArtMode("")).toBe("proxy");
    expect(normalizeArtMode(undefined)).toBe("proxy");
    expect(normalizeArtMode("garbage")).toBe("proxy");
  });
});

describe("parsePrintParams", () => {
  it("applies sensible defaults for an empty query", () => {
    const p = parsePrintParams("");
    expect(p.deckId).toBeNull();
    expect(p.cardIds).toEqual([]);
    expect(p.isGallery).toBe(false);
    expect(p.cardSize).toBe("standard");
    expect(p.qtyOneEach).toBe(false);
    expect(p.paper).toBe("letter");
    expect(p.orientation).toBe("portrait");
    expect(p.excludeSet.size).toBe(0);
    expect(p.noBasicEnergy).toBe(false);
    expect(p.artModes).toEqual(["proxy"]);
    expect(p.defaultArtMode).toBe("proxy");
    expect(p.cropMarks).toBe(true); // on unless crop=0
    expect(p.autoPrint).toBe(false);
  });

  it("parses a jumbo two-card print with per-card art", () => {
    const p = parsePrintParams("cardId=a,b&size=jumbo&art=original,cleaned&orientation=landscape&auto=1");
    expect(p.cardIds).toEqual(["a", "b"]);
    expect(p.cardSize).toBe("jumbo");
    expect(p.artModes).toEqual(["original", "cleaned"]);
    expect(p.defaultArtMode).toBe("original");
    expect(p.orientation).toBe("landscape");
    expect(p.autoPrint).toBe(true);
  });

  it("parses gallery filters and toggles", () => {
    const p = parsePrintParams("gallery=1&exclude=pokemon,items&noBasicEnergy=1&qty=one-each&crop=0&paper=super-b");
    expect(p.isGallery).toBe(true);
    expect([...p.excludeSet].sort()).toEqual(["items", "pokemon"]);
    expect(p.noBasicEnergy).toBe(true);
    expect(p.qtyOneEach).toBe(true);
    expect(p.cropMarks).toBe(false);
    expect(p.paper).toBe("super-b");
  });

  it("trims whitespace and coerces unknown art tokens to proxy", () => {
    const p = parsePrintParams("art= original , bogus ");
    expect(p.artModes).toEqual(["original", "proxy"]);
  });

  it("accepts a URLSearchParams instance directly", () => {
    const p = parsePrintParams(new URLSearchParams({ deckId: "deck-1" }));
    expect(p.deckId).toBe("deck-1");
  });
});

describe("buildJumboPrintUrl", () => {
  it("builds a one-up single-card URL (portrait default, no orientation param)", () => {
    const url = buildJumboPrintUrl({ ids: ["a"], arts: ["proxy"], layout: "one-up" });
    const q = new URLSearchParams(url.split("?")[1]);
    expect(url.startsWith("/print.html?")).toBe(true);
    expect(q.get("cardId")).toBe("a");
    expect(q.get("size")).toBe("jumbo");
    expect(q.get("art")).toBe("proxy");
    expect(q.get("auto")).toBe("1");
    expect(q.get("orientation")).toBeNull();
  });

  it("adds landscape orientation for a two-up pair", () => {
    const url = buildJumboPrintUrl({ ids: ["a", "b"], arts: ["original", "cleaned"], layout: "two-up" });
    const q = new URLSearchParams(url.split("?")[1]);
    expect(q.get("cardId")).toBe("a,b");
    expect(q.get("art")).toBe("original,cleaned");
    expect(q.get("orientation")).toBe("landscape");
  });

  it("round-trips through parsePrintParams", () => {
    const url = buildJumboPrintUrl({ ids: ["x", "y"], arts: ["cleaned", "proxy"], layout: "two-up" });
    const p = parsePrintParams(url.split("?")[1]);
    expect(p.cardIds).toEqual(["x", "y"]);
    expect(p.artModes).toEqual(["cleaned", "proxy"]);
    expect(p.cardSize).toBe("jumbo");
    expect(p.orientation).toBe("landscape");
    expect(p.autoPrint).toBe(true);
  });
});

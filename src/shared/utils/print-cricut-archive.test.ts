import { describe, expect, test } from "bun:test";
import {
  cricutArchiveFilename,
  cricutFilename,
  cricutManifest,
  cricutPagesLabel,
  cricutPixelDims,
  fileSlug,
  planCricutArchive,
  totalCricutCopies,
  type CricutArchiveSource,
} from "./print-cricut-archive";

const src = (id: string, name: string, artMode: CricutArchiveSource["artMode"] = "proxy", artUrl = `/api/img/${id}`): CricutArchiveSource =>
  ({ card: { id, name }, artMode, artUrl });

describe("fileSlug", () => {
  test("lowercases, strips accents and apostrophes, hyphenates the rest", () => {
    expect(fileSlug("Charizard ex")).toBe("charizard-ex");
    expect(fileSlug("Pokémon Catcher")).toBe("pokemon-catcher");
    expect(fileSlug("Professor's Research")).toBe("professors-research");
    expect(fileSlug("Farfetch'd (Galarian)")).toBe("farfetchd-galarian");
    expect(fileSlug("sv03-125")).toBe("sv03-125");
    expect(fileSlug("  --weird__name-- ")).toBe("weird-name");
  });
});

describe("cricutFilename", () => {
  test("puts the copy count first so Design Space layer names read at a glance", () => {
    expect(cricutFilename(4, "Charizard ex", "sv03-125")).toBe("4x-charizard-ex-sv03-125.png");
  });
  test("tags non-proxy art modes", () => {
    expect(cricutFilename(1, "Pikachu", "sv08-057", "original")).toBe("1x-pikachu-sv08-057-original.png");
  });
});

describe("planCricutArchive", () => {
  test("dedupes repeats, counts copies, keeps first-seen order and index", () => {
    const items = planCricutArchive([
      src("a", "Alpha"),
      src("b", "Beta"),
      src("a", "Alpha"),
      src("a", "Alpha"),
      src("c", "Gamma"),
      src("b", "Beta"),
    ]);
    expect(items.map((i) => [i.cardId, i.copies, i.firstIndex])).toEqual([
      ["a", 3, 0],
      ["b", 2, 1],
      ["c", 1, 4],
    ]);
    expect(items[0].filename).toBe("3x-alpha-a.png");
    expect(totalCricutCopies(items)).toBe(6);
  });

  test("the same card in two art modes is two files", () => {
    const items = planCricutArchive([
      src("a", "Alpha", "proxy", "/clean/a"),
      src("a", "Alpha", "original", "/source/a"),
    ]);
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.filename)).toEqual(["1x-alpha-a.png", "1x-alpha-a-original.png"]);
  });

  test("colliding slugs get a numeric suffix rather than overwriting", () => {
    const items = planCricutArchive([src("x.1", "Same"), src("x-1", "Same")]);
    expect(items.map((i) => i.filename)).toEqual(["1x-same-x-1.png", "1x-same-x-1-2.png"]);
  });

  test("empty input plans nothing", () => {
    expect(planCricutArchive([])).toEqual([]);
  });
});

describe("cricutPixelDims", () => {
  test("63×87mm at 300 dpi is 744×1028", () => {
    expect(cricutPixelDims("standard", 300)).toEqual({ w: 744, h: 1028 });
  });
  test("jumbo at 300 dpi", () => {
    expect(cricutPixelDims("jumbo", 300)).toEqual({ w: 1559, h: 2185 });
  });
});

describe("cricutManifest", () => {
  const items = planCricutArchive([src("a", "Alpha"), src("a", "Alpha"), src("b", "Beta", "original", "/s/b")]);
  const text = cricutManifest(items, { cardSize: "standard", dpi: 300, cornerMm: 3, label: "Lost Zone Box" });

  test("states the physical size in mm and inches and the pixel size", () => {
    expect(text).toContain("63 × 87 mm (2.480 × 3.425 in)");
    expect(text).toContain("744 × 1028 px, tagged 300 dpi");
    expect(text).toContain("3 mm corners");
  });
  test("totals copies and pages for Letter and A3", () => {
    expect(text).toContain("2 unique cards, 3 copies: ~1 Letter page (4/page) or ~1 A3 page (16/page)");
    expect(text).toContain("Pick A3 in Design Space");
  });
  test("lists every file with its count and flags non-proxy art", () => {
    expect(text).toContain("  2x-alpha-a.png  ×2  Alpha  a");
    expect(text).toContain("  1x-beta-b-original.png  ×1  Beta  b  (original)");
  });
  test("carries the label into the heading", () => {
    expect(text.split("\n")[0]).toBe("Cricut Design Space — Print Then Cut — Lost Zone Box");
  });
  test("pages round up", () => {
    const many = planCricutArchive(Array.from({ length: 9 }, (_, i) => src(`c${i}`, `Card ${i}`)));
    const t = cricutManifest(many, { cardSize: "standard", dpi: 300, cornerMm: 3 });
    expect(t).toContain("9 copies: ~3 Letter pages (4/page) or ~1 A3 page (16/page)");
    expect(t.split("\n")[0]).toBe("Cricut Design Space — Print Then Cut");
  });
});

describe("cricutPagesLabel", () => {
  test("a 60-card deck is 15 Letter sheets or 4 A3 sheets", () => {
    expect(cricutPagesLabel(60, "standard")).toBe("~15 Letter pages (4/page) or ~4 A3 pages (16/page)");
  });
  test("jumbo is 1-up on Letter and 2×2 on A3", () => {
    expect(cricutPagesLabel(4, "jumbo")).toBe("~4 Letter pages (1/page) or ~1 A3 page (4/page)");
  });
});

describe("cricutArchiveFilename", () => {
  test("slugs the deck label and falls back to cards", () => {
    expect(cricutArchiveFilename("Lost Zone Box", "standard", 300)).toBe("cricut-ptc-lost-zone-box-63x87mm-300dpi.zip");
    expect(cricutArchiveFilename(null, "standard", 300)).toBe("cricut-ptc-cards-63x87mm-300dpi.zip");
    expect(cricutArchiveFilename("", "jumbo", 300)).toBe("cricut-ptc-cards-132x185mm-300dpi.zip");
  });
});

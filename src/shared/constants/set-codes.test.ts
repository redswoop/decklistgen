import { describe, test, expect } from "bun:test";
import { getEra, SET_MAP } from "./set-codes.js";

describe("getEra", () => {
  test("classifies Scarlet & Violet sets", () => {
    expect(getEra("sv01")).toBe("sv");
    expect(getEra("sv06.5")).toBe("sv");
    expect(getEra("sv10.5w")).toBe("sv");
    expect(getEra("sve")).toBe("sv");
    expect(getEra("svp")).toBe("sv");
  });

  test("classifies Mega Evolution sets", () => {
    expect(getEra("me01")).toBe("me");
    expect(getEra("me02")).toBe("me");
    expect(getEra("me02.5")).toBe("me");
    expect(getEra("me03")).toBe("me");
    expect(getEra("me04")).toBe("me");
    expect(getEra("mep")).toBe("me");
    expect(getEra("mee")).toBe("me");
  });

  test("classifies Sword & Shield (and pre-SV) sets", () => {
    expect(getEra("swsh1")).toBe("swsh");
    expect(getEra("swsh12.5")).toBe("swsh");
    expect(getEra("swshp")).toBe("swsh");
    expect(getEra("cel25")).toBe("swsh");
    expect(getEra("fut2020")).toBe("swsh");
  });

  test("every set in SET_MAP resolves to a known era", () => {
    const known = new Set(["sv", "swsh", "me"]);
    for (const tcgdexId of Object.values(SET_MAP)) {
      expect(known.has(getEra(tcgdexId))).toBe(true);
    }
  });
});

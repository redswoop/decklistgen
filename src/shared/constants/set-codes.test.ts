import { describe, test, expect } from "bun:test";
import { getEra, SET_MAP, REVERSE_SET_MAP, canonicalSetNumber } from "./set-codes.js";

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
    expect(getEra("me05")).toBe("me");
    expect(getEra("mep")).toBe("me");
    expect(getEra("mee")).toBe("me");
  });

  test("classifies the 30th anniversary sets as Mega Evolution", () => {
    expect(getEra("30th")).toBe("me");
    expect(getEra("30th-c")).toBe("me");
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

describe("30th anniversary set codes", () => {
  test("maps both halves to their TCGdex sets and back", () => {
    expect(SET_MAP["30C"]).toBe("30th");
    expect(SET_MAP["30CC"]).toBe("30th-c");
    expect(REVERSE_SET_MAP["30th"]).toBe("30C");
    expect(REVERSE_SET_MAP["30th-c"]).toBe("30CC");
  });
});

describe("canonicalSetNumber", () => {
  test("routes 30C CC-numbered cards to the Classic Collection", () => {
    expect(canonicalSetNumber("30C", "CC12")).toEqual({ setCode: "30CC", number: "12" });
    expect(canonicalSetNumber("30c", "cc1")).toEqual({ setCode: "30CC", number: "1" });
  });

  test("leaves main-set numbers alone", () => {
    expect(canonicalSetNumber("30C", "149")).toEqual({ setCode: "30C", number: "149" });
    expect(canonicalSetNumber("OBF", "125")).toEqual({ setCode: "OBF", number: "125" });
  });

  test("ignores prefixes the set has no sub-set for", () => {
    expect(canonicalSetNumber("OBF", "CC12")).toEqual({ setCode: "OBF", number: "CC12" });
    expect(canonicalSetNumber("30C", "XY12")).toEqual({ setCode: "30C", number: "XY12" });
  });
});

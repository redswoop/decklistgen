import { describe, test, expect } from "bun:test";
import { resolveChainNames, megaBaseSpecies } from "./evolution-chain.js";

describe("resolveChainNames", () => {
  // Charmander → Charmeleon → Charizard ex
  const parents: Record<string, string | undefined> = {
    Charizard: "Charmeleon",
    Charmeleon: "Charmander",
    Charmander: undefined,
  };
  const lookup = async (name: string) => parents[name];

  test("builds a full chain down to the Basic", async () => {
    const chain = await resolveChainNames("Charizard ex", "Charmeleon", lookup);
    expect(chain).toEqual(["Charmander", "Charmeleon", "Charizard ex"]);
  });

  test("a Basic resolves to a single-element chain", async () => {
    const chain = await resolveChainNames("Charmander", undefined, lookup);
    expect(chain).toEqual(["Charmander"]);
  });

  test("stops at a gap (lookup returns undefined) keeping the named ancestor", async () => {
    const chain = await resolveChainNames("Charizard ex", "Charmeleon", async () => undefined);
    expect(chain).toEqual(["Charmeleon", "Charizard ex"]);
  });

  test("respects the depth cap", async () => {
    const deep = async (name: string) => `parent-of-${name}`;
    const chain = await resolveChainNames("Top", "p1", deep, 2);
    expect(chain).toHaveLength(3); // start + 2 levels
  });

  test("guards against cycles", async () => {
    const cyclic: Record<string, string> = { A: "B", B: "A" };
    const chain = await resolveChainNames("A", "B", async (n) => cyclic[n]);
    expect(chain).toEqual(["B", "A"]);
  });
});

describe("megaBaseSpecies", () => {
  test("strips the Mega prefix, ex suffix, and X/Y variant tag to the base species", () => {
    expect(megaBaseSpecies("Mega Feraligatr ex")).toBe("Feraligatr");
    expect(megaBaseSpecies("Mega Charizard ex")).toBe("Charizard");
    expect(megaBaseSpecies("Mega Charizard X ex")).toBe("Charizard");
    expect(megaBaseSpecies("Mega Charizard Y ex")).toBe("Charizard");
    expect(megaBaseSpecies("Mega Mewtwo Y")).toBe("Mewtwo");
    expect(megaBaseSpecies("Mega Lucario")).toBe("Lucario");
  });

  test("returns null for non-Mega names", () => {
    expect(megaBaseSpecies("Charizard ex")).toBeNull();
    expect(megaBaseSpecies("Feraligatr")).toBeNull();
  });
});

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { join } from "node:path";
import {
  clearTemplateSetCache,
  getAllSets,
  getSet,
  listSetSummaries,
} from "../../../services/template-set-store.js";
import { resolveTemplate } from "../../../../shared/utils/resolve-template.js";
import type { TcgdexCard } from "../../../../shared/types/card.js";

// Point the store at the real shipped templates so we exercise the actual
// JSON files (not synthesized fixtures). This proves the `headered` set is
// discovered, loadable, and inherits unchanged slots from `default`.

let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = {
    BUILTIN_TEMPLATES_PATH: process.env.BUILTIN_TEMPLATES_PATH,
    TEMPLATE_SETS_PATH: process.env.TEMPLATE_SETS_PATH,
    BUILTIN_SHADOWS_PATH: process.env.BUILTIN_SHADOWS_PATH,
  };
  process.env.BUILTIN_TEMPLATES_PATH = join(import.meta.dir, "..");
  // Point user + shadow paths somewhere empty so we only see shipped sets.
  process.env.TEMPLATE_SETS_PATH = "/tmp/__decklistgen_test_empty_users__";
  process.env.BUILTIN_SHADOWS_PATH = "/tmp/__decklistgen_test_empty_shadows__";
  clearTemplateSetCache();
});

afterEach(() => {
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  clearTemplateSetCache();
});

describe("headered template-set (shipped)", () => {
  it("is discovered as a builtin set", () => {
    const summaries = listSetSummaries();
    const ids = summaries.map((s) => s.id);
    expect(ids).toContain("headered");
    const summary = summaries.find((s) => s.id === "headered")!;
    expect(summary.origin).toBe("builtin");
    expect(summary.name).toBe("Headered");
  });

  it("declares extends=default", () => {
    const set = getSet("headered");
    expect(set).toBeDefined();
    expect(set!.manifest.extends).toBe("default");
  });

  it("overrides all five core slots", () => {
    const set = getSet("headered")!;
    const slots = Object.keys(set.slotTemplates).sort();
    expect(slots).toEqual([
      "basic-energy",
      "pokemon-fullart",
      "pokemon-standard",
      "pokemon-vstar",
      "trainer",
    ]);
  });

  it("every overridden slot contains a header-pill or header-banner element", () => {
    const set = getSet("headered")!;
    const findHeader = (els: any[]): boolean => {
      for (const el of els) {
        if (typeof el?.id === "string" && (el.id === "header-pill" || el.id === "header-banner")) return true;
        if (Array.isArray(el?.children) && findHeader(el.children)) return true;
      }
      return false;
    };
    for (const [slot, tpl] of Object.entries(set.slotTemplates)) {
      const ok = findHeader((tpl as any).elements ?? []);
      expect(ok, `slot ${slot} should have a header pill/banner element`).toBe(true);
    }
  });

  it("a basic pokemon resolves to the headered slot when deck-set=headered", () => {
    const card = {
      id: "test-pikachu",
      name: "Pikachu",
      category: "Pokemon",
      stage: "Basic",
    } as unknown as TcgdexCard;
    const resolved = resolveTemplate(
      card,
      { deckSetId: "headered", globalSetId: "default" },
      getAllSets(),
    );
    expect(resolved.resolvedFromSetId).toBe("headered");
    expect(resolved.slot).toBe("pokemon-standard");
    const ids = (resolved.template as any).elements.map((e: any) => e.id);
    expect(ids).toContain("header-pill");
  });

  it("a trainer card resolves to the headered trainer slot with name in the banner", () => {
    const card = {
      id: "test-iono",
      name: "Iono",
      category: "Trainer",
      trainerType: "Supporter",
    } as unknown as TcgdexCard;
    const resolved = resolveTemplate(
      card,
      { deckSetId: "headered", globalSetId: "default" },
      getAllSets(),
    );
    expect(resolved.resolvedFromSetId).toBe("headered");
    expect(resolved.slot).toBe("trainer");
    // The banner should now contain a name-stack with two text children (trainerType + _baseName).
    const banner: any = (resolved.template as any).elements.find((e: any) => e.id === "header-banner");
    expect(banner).toBeDefined();
    const stack = banner.children.find((c: any) => c.id === "trainer-name-stack");
    expect(stack).toBeDefined();
    const stackTexts = stack.children.filter((c: any) => c.type === "text");
    expect(stackTexts.length).toBe(2);
    expect(stackTexts.some((t: any) => t.bind?.text === "_baseName")).toBe(true);
  });

  it("default set remains unchanged", () => {
    const def = getSet("default")!;
    const slots = Object.keys(def.slotTemplates).sort();
    expect(slots).toEqual([
      "basic-energy",
      "pokemon-fullart",
      "pokemon-standard",
      "pokemon-vstar",
      "trainer",
    ]);
    // Default's pokemon-standard should NOT have a header-pill — only floating elements.
    const ps: any = def.slotTemplates["pokemon-standard"];
    const ids = (ps.elements ?? []).map((e: any) => e.id);
    expect(ids).toContain("name-cluster");
    expect(ids).toContain("hp-cluster");
    expect(ids).not.toContain("header-pill");
  });
});

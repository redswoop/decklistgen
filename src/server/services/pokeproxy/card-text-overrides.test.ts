import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import { applyCardTextOverride } from "./card-text-overrides.js";

const PATH = process.env.CARD_TEXT_OVERRIDES_PATH!;

function writeOverrides(obj: unknown) {
  writeFileSync(PATH, JSON.stringify(obj));
}

beforeEach(() => {
  if (existsSync(PATH)) unlinkSync(PATH);
});

afterEach(() => {
  if (existsSync(PATH)) unlinkSync(PATH);
});

const baseData = () => ({
  id: "me04-082",
  name: "Special Red Card",
  set: { id: "me04", name: "Chaos Rising" },
});

describe("applyCardTextOverride", () => {
  test("returns data unchanged when overrides file is missing", () => {
    const data = baseData();
    expect(applyCardTextOverride("me04-082", data)).toEqual(data);
  });

  test("returns data unchanged when there is no matching entry", () => {
    writeOverrides({ byId: { "me04-001": { effect: "patched" } } });
    const data = baseData();
    expect(applyCardTextOverride("me04-082", data)).toEqual(data);
  });

  test("byId entry merges on top of card data", () => {
    writeOverrides({ byId: { "me04-082": { effect: "patched effect" } } });
    const result = applyCardTextOverride("me04-082", baseData());
    expect(result.effect).toBe("patched effect");
  });

  test("byName entry applies to all variants in the named set", () => {
    writeOverrides({
      byName: { me04: { "Special Red Card": { effect: "shared text" } } },
    });
    const v1 = applyCardTextOverride("me04-082", baseData());
    const v2 = applyCardTextOverride("me04-113", { ...baseData(), id: "me04-113" });
    expect(v1.effect).toBe("shared text");
    expect(v2.effect).toBe("shared text");
  });

  test("byName only matches inside the named set", () => {
    writeOverrides({
      byName: { me04: { "Special Red Card": { effect: "CRI only" } } },
    });
    const otherSet = { ...baseData(), set: { id: "me03", name: "Perfect Order" } };
    expect(applyCardTextOverride("me03-099", otherSet)).toEqual(otherSet);
  });

  test("byId wins over byName when both match", () => {
    writeOverrides({
      byName: { me04: { "Special Red Card": { effect: "group text" } } },
      byId: { "me04-082": { effect: "per-card text" } },
    });
    const result = applyCardTextOverride("me04-082", baseData());
    expect(result.effect).toBe("per-card text");
  });

  test("override wins over an existing same-named field on raw data", () => {
    writeOverrides({ byId: { "me04-082": { effect: "override" } } });
    const data = { ...baseData(), effect: "stale" };
    expect(applyCardTextOverride("me04-082", data).effect).toBe("override");
  });

  test("malformed JSON file is ignored, data passes through", () => {
    writeFileSync(PATH, "{ this is not json");
    const data = baseData();
    expect(applyCardTextOverride("me04-082", data)).toEqual(data);
  });

  test("live-reloads on each call", () => {
    const data = baseData();
    expect(applyCardTextOverride("me04-082", data)).toEqual(data);
    writeOverrides({ byId: { "me04-082": { effect: "now present" } } });
    expect(applyCardTextOverride("me04-082", data).effect).toBe("now present");
  });

  test("missing name or setId on data short-circuits byName lookup safely", () => {
    writeOverrides({
      byName: { me04: { "Special Red Card": { effect: "x" } } },
    });
    const noName = { id: "me04-082", set: { id: "me04" } };
    const noSet = { id: "me04-082", name: "Special Red Card" };
    expect(applyCardTextOverride("me04-082", noName)).toEqual(noName);
    expect(applyCardTextOverride("me04-082", noSet)).toEqual(noSet);
  });
});

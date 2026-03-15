import { describe, test, expect } from "bun:test";
import { resolveBinding, applyBindingsToTree, isTruthy } from "./resolve-bindings.js";
import type { NodeState } from "./types/editor.js";

describe("resolveBinding", () => {
  const data = {
    name: "Arcanine ex",
    hp: 280,
    types: ["Fire"],
    attacks: [
      { name: "Raging Claws", damage: "30+", cost: ["Fire", "Fire"], effect: "Does more damage" },
      { name: "Bright Flame", damage: "250", cost: ["Fire", "Fire", "Fire"], effect: "" },
    ],
    weaknesses: [{ type: "Lightning", value: "×2" }],
    resistances: [{ type: "Fighting", value: "-30" }],
    evolveFrom: "Growlithe",
    set: { name: "Shrouded Fable" },
    localId: "036",
  };

  test("resolves simple path", () => {
    expect(resolveBinding("name", data)).toBe("Arcanine ex");
    expect(resolveBinding("hp", data)).toBe(280);
  });

  test("resolves array index", () => {
    expect(resolveBinding("types[0]", data)).toBe("Fire");
  });

  test("resolves nested paths", () => {
    expect(resolveBinding("attacks[0].name", data)).toBe("Raging Claws");
    expect(resolveBinding("attacks[1].cost[2]", data)).toBe("Fire");
    expect(resolveBinding("weaknesses[0].type", data)).toBe("Lightning");
    expect(resolveBinding("set.name", data)).toBe("Shrouded Fable");
  });

  test("returns undefined for missing paths", () => {
    expect(resolveBinding("missing", data)).toBeUndefined();
    expect(resolveBinding("attacks[5].name", data)).toBeUndefined();
  });

  test("returns undefined for empty path or data", () => {
    expect(resolveBinding("", data)).toBeUndefined();
    expect(resolveBinding("hp", {} as Record<string, unknown>)).toBeUndefined();
  });
});

describe("isTruthy", () => {
  test("falsy values", () => {
    expect(isTruthy(undefined)).toBe(false);
    expect(isTruthy(null)).toBe(false);
    expect(isTruthy("")).toBe(false);
    expect(isTruthy(0)).toBe(false);
    expect(isTruthy(false)).toBe(false);
    expect(isTruthy([])).toBe(false);
  });

  test("truthy values", () => {
    expect(isTruthy("hello")).toBe(true);
    expect(isTruthy(1)).toBe(true);
    expect(isTruthy(42)).toBe(true);
    expect(isTruthy(true)).toBe(true);
    expect(isTruthy([1])).toBe(true);
    expect(isTruthy({ a: 1 })).toBe(true);
    expect(isTruthy("0")).toBe(true);
  });
});

describe("showIf", () => {
  const data = {
    hp: 280,
    abilities: [{ name: "Intimidate", effect: "Reduce damage" }],
    attacks: [],
    evolveFrom: "",
    stage: "Basic",
  };

  test("keeps elements with truthy showIf", () => {
    const elements: NodeState[] = [
      { type: "text", props: { text: "HP" }, showIf: "hp" },
    ];
    const result = applyBindingsToTree(elements, data);
    expect(result).toHaveLength(1);
  });

  test("removes elements with falsy showIf (empty string)", () => {
    const elements: NodeState[] = [
      { type: "text", props: { text: "Evolves from" }, showIf: "evolveFrom" },
    ];
    const result = applyBindingsToTree(elements, data);
    expect(result).toHaveLength(0);
  });

  test("removes elements with falsy showIf (empty array)", () => {
    const elements: NodeState[] = [
      { type: "text", props: { text: "Attack" }, showIf: "attacks" },
    ];
    const result = applyBindingsToTree(elements, data);
    expect(result).toHaveLength(0);
  });

  test("keeps elements with truthy showIf (non-empty array)", () => {
    const elements: NodeState[] = [
      { type: "text", props: { text: "Ability" }, showIf: "abilities" },
    ];
    const result = applyBindingsToTree(elements, data);
    expect(result).toHaveLength(1);
  });

  test("removes elements with undefined showIf path", () => {
    const elements: NodeState[] = [
      { type: "text", props: { text: "X" }, showIf: "nonexistent" },
    ];
    const result = applyBindingsToTree(elements, data);
    expect(result).toHaveLength(0);
  });

  test("works on nested children", () => {
    const elements: NodeState[] = [
      {
        type: "box", props: { direction: "column" },
        children: [
          { type: "text", props: { text: "Always" } },
          { type: "text", props: { text: "Maybe" }, showIf: "evolveFrom" },
          { type: "text", props: { text: "Also always" } },
        ],
      },
    ];
    const result = applyBindingsToTree(elements, data);
    expect(result[0].children).toHaveLength(2);
    expect(result[0].children![0].props.text).toBe("Always");
    expect(result[0].children![1].props.text).toBe("Also always");
  });

  test("showIf combined with bindings", () => {
    const elements: NodeState[] = [
      {
        type: "text", props: { text: "placeholder" },
        bind: { text: "stage" },
        showIf: "stage",
      },
    ];
    const result = applyBindingsToTree(elements, data);
    expect(result).toHaveLength(1);
    expect(result[0].props.text).toBe("Basic");
  });
});

describe("repeater", () => {
  const data = {
    name: "Arcanine ex",
    hp: 280,
    attacks: [
      { name: "Slash", damage: "30", cost: ["Fire"], effect: "" },
      { name: "Blaze", damage: "120", cost: ["Fire", "Fire", "Colorless"], effect: "Discard energy" },
    ],
    abilities: [{ type: "Ability", name: "Flash Fire", effect: "Prevents damage" }],
    types: ["Fire"],
  };

  test("basic repeater expands to wrapper box with N children", () => {
    const elements: NodeState[] = [
      {
        type: "repeater",
        id: "attacks-rep",
        props: { direction: "column" },
        bind: { items: "attacks" },
        itemTemplate: {
          type: "text", props: { text: "?", fontSize: 24 },
          bind: { text: "name" },
        },
      },
    ];
    const result = applyBindingsToTree(elements, data);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("box");
    expect(result[0].id).toBe("attacks-rep");
    expect(result[0].props.direction).toBe("column");
    expect(result[0].children).toHaveLength(2);
    expect(result[0].children![0].props.text).toBe("Slash");
    expect(result[0].children![1].props.text).toBe("Blaze");
  });

  test("$item binding for primitive collections", () => {
    const elements: NodeState[] = [
      {
        type: "repeater", props: {},
        bind: { items: "types" },
        itemTemplate: {
          type: "image", props: { src: "energy", energyType: "Colorless" },
          bind: { energyType: "$item" },
        },
      },
    ];
    const result = applyBindingsToTree(elements, data);
    expect(result[0].children).toHaveLength(1);
    expect(result[0].children![0].props.energyType).toBe("Fire");
  });

  test("$index binding available", () => {
    const elements: NodeState[] = [
      {
        type: "repeater", props: {},
        bind: { items: "attacks" },
        itemTemplate: {
          type: "text", props: { text: "?" },
          bind: { text: "$index" },
        },
      },
    ];
    const result = applyBindingsToTree(elements, data);
    expect(result[0].children![0].props.text).toBe(0);
    expect(result[0].children![1].props.text).toBe(1);
  });

  test("nested repeaters (energy dots inside attacks)", () => {
    const elements: NodeState[] = [
      {
        type: "repeater", props: { direction: "column" },
        bind: { items: "attacks" },
        itemTemplate: {
          type: "box", props: { direction: "row" },
          children: [
            {
              type: "repeater", props: { direction: "row" },
              bind: { items: "cost" },
              itemTemplate: {
                type: "image", props: { src: "energy", energyType: "Colorless", radius: 14 },
                bind: { energyType: "$item" },
              },
            },
            { type: "text", props: { text: "?", fontSize: 24 }, bind: { text: "name" } },
            { type: "text", props: { text: "?", fontSize: 24 }, bind: { text: "damage" } },
          ],
        },
      },
    ];
    const result = applyBindingsToTree(elements, data);
    // Outer repeater: 2 attacks
    const outerBox = result[0];
    expect(outerBox.children).toHaveLength(2);

    // First attack: 1 cost dot
    const atk0 = outerBox.children![0];
    expect(atk0.type).toBe("box");
    expect(atk0.children).toHaveLength(3); // cost-box, name, damage
    const costBox0 = atk0.children![0];
    expect(costBox0.type).toBe("box"); // expanded repeater
    expect(costBox0.children).toHaveLength(1);
    expect(costBox0.children![0].props.energyType).toBe("Fire");
    expect(atk0.children![1].props.text).toBe("Slash");
    expect(atk0.children![2].props.text).toBe("30");

    // Second attack: 3 cost dots
    const atk1 = outerBox.children![1];
    const costBox1 = atk1.children![0];
    expect(costBox1.children).toHaveLength(3);
    expect(costBox1.children![0].props.energyType).toBe("Fire");
    expect(costBox1.children![1].props.energyType).toBe("Fire");
    expect(costBox1.children![2].props.energyType).toBe("Colorless");
    expect(atk1.children![1].props.text).toBe("Blaze");
    expect(atk1.children![2].props.text).toBe("120");
  });

  test("empty collection produces no output", () => {
    const elements: NodeState[] = [
      {
        type: "repeater", props: {},
        bind: { items: "abilities" },
        itemTemplate: { type: "text", props: { text: "?" } },
      },
    ];
    const emptyData = { abilities: [] };
    const result = applyBindingsToTree(elements, emptyData);
    expect(result).toHaveLength(0);
  });

  test("missing collection produces no output", () => {
    const elements: NodeState[] = [
      {
        type: "repeater", props: {},
        bind: { items: "nonexistent" },
        itemTemplate: { type: "text", props: { text: "?" } },
      },
    ];
    const result = applyBindingsToTree(elements, data);
    expect(result).toHaveLength(0);
  });

  test("item context shadows parent but parent still accessible", () => {
    const elements: NodeState[] = [
      {
        type: "repeater", props: {},
        bind: { items: "attacks" },
        itemTemplate: {
          type: "box", props: { direction: "row" },
          children: [
            { type: "text", props: { text: "?" }, bind: { text: "name" } },
            { type: "text", props: { text: "?" }, bind: { text: "hp" } },
          ],
        },
      },
    ];
    const result = applyBindingsToTree(elements, data);
    const row = result[0].children![0];
    expect(row.children![0].props.text).toBe("Slash"); // from item
    expect(row.children![1].props.text).toBe(280);     // from parent
  });

  test("showIf inside repeater item template", () => {
    const elements: NodeState[] = [
      {
        type: "repeater", props: { direction: "column" },
        bind: { items: "attacks" },
        itemTemplate: {
          type: "box", props: { direction: "column" },
          children: [
            { type: "text", props: { text: "?" }, bind: { text: "name" } },
            { type: "text", props: { text: "?" }, bind: { text: "effect" }, showIf: "effect" },
          ],
        },
      },
    ];
    const result = applyBindingsToTree(elements, data);
    // Attack 0: effect is "" (falsy), so effect text removed
    expect(result[0].children![0].children).toHaveLength(1);
    // Attack 1: effect is "Discard energy" (truthy), so kept
    expect(result[0].children![1].children).toHaveLength(2);
    expect(result[0].children![1].children![1].props.text).toBe("Discard energy");
  });

  test("showIf on the repeater itself", () => {
    const elements: NodeState[] = [
      {
        type: "repeater", props: {},
        bind: { items: "attacks" },
        showIf: "attacks",
        itemTemplate: { type: "text", props: { text: "?" }, bind: { text: "name" } },
      },
    ];
    // With attacks
    const result1 = applyBindingsToTree(elements, data);
    expect(result1).toHaveLength(1);

    // Without attacks
    const result2 = applyBindingsToTree(elements, { attacks: [] });
    expect(result2).toHaveLength(0);
  });

  test("repeater does not mutate input", () => {
    const elements: NodeState[] = [
      {
        type: "repeater", props: {},
        bind: { items: "attacks" },
        itemTemplate: { type: "text", props: { text: "?" }, bind: { text: "name" } },
      },
    ];
    applyBindingsToTree(elements, data);
    expect(elements[0].type).toBe("repeater");
    expect(elements[0].itemTemplate!.props.text).toBe("?");
  });

  test("repeater wrapper box inherits props", () => {
    const elements: NodeState[] = [
      {
        type: "repeater",
        props: { direction: "row", gap: 10, marginTop: 8 },
        bind: { items: "types" },
        itemTemplate: { type: "text", props: { text: "?" }, bind: { text: "$item" } },
      },
    ];
    const result = applyBindingsToTree(elements, data);
    expect(result[0].props.direction).toBe("row");
    expect(result[0].props.gap).toBe(10);
    expect(result[0].props.marginTop).toBe(8);
  });
});

describe("_templateIndex preservation", () => {
  test("surviving siblings preserve original template indices when earlier siblings are filtered", () => {
    const elements: NodeState[] = [
      {
        type: "box", props: { direction: "column" },
        children: [
          {
            type: "repeater", props: { direction: "column" },
            bind: { items: "abilities" },
            itemTemplate: { type: "text", props: { text: "?" }, bind: { text: "name" } },
          },
          {
            type: "repeater", props: { direction: "column" },
            bind: { items: "attacks" },
            itemTemplate: { type: "text", props: { text: "?" }, bind: { text: "name" } },
          },
          { type: "text", props: { text: "footer" } },
        ],
      },
    ];
    // No abilities → first repeater is filtered out
    const data = { abilities: [], attacks: [{ name: "Slash" }] };
    const result = applyBindingsToTree(elements, data);
    const children = result[0].children!;
    // Only 2 children survive (attacks wrapper + footer)
    expect(children).toHaveLength(2);
    // Attacks wrapper should have _templateIndex=1 (original position)
    expect(children[0].props._templateIndex).toBe(1);
    // Footer text should have _templateIndex=2
    expect(children[1].props._templateIndex).toBe(2);
  });

  test("showIf-filtered nodes shift indices correctly", () => {
    const elements: NodeState[] = [
      {
        type: "box", props: { direction: "column" },
        children: [
          { type: "text", props: { text: "hidden" }, showIf: "missing" },
          { type: "text", props: { text: "visible" } },
        ],
      },
    ];
    const result = applyBindingsToTree(elements, {});
    const children = result[0].children!;
    expect(children).toHaveLength(1);
    expect(children[0].props.text).toBe("visible");
    expect(children[0].props._templateIndex).toBe(1);
  });
});

describe("applyBindingsToTree backward compat", () => {
  test("works with no repeaters or showIf", () => {
    const data = { hp: 280, name: "Arcanine" };
    const elements: NodeState[] = [
      {
        type: "box", id: "test", props: { anchorX: 0, anchorY: 0, direction: "row" },
        children: [
          { type: "text", props: { text: "placeholder", fontSize: 24 }, bind: { text: "hp" } },
        ],
      },
    ];
    const result = applyBindingsToTree(elements, data);
    expect(elements[0].children![0].props.text).toBe("placeholder"); // original unchanged
    expect(result[0].children![0].props.text).toBe(280);
  });
});

import { describe, expect, test } from "bun:test";
import { resolveFontSizes } from "./resolve-font-sizes.js";
import type { NodeState } from "./types/editor.js";

const sizeMap: Record<string, number> = {
  attackName: 28,
  damage: 36,
  footer: 14,
  default: 24,
};

describe("resolveFontSizes", () => {
  test("replaces $token with number from size map", () => {
    const elements: NodeState[] = [
      { type: "text", props: { fontSize: "$attackName" } },
    ];
    resolveFontSizes(elements, sizeMap);
    expect(elements[0].props.fontSize).toBe(28);
  });

  test("leaves raw numbers unchanged", () => {
    const elements: NodeState[] = [
      { type: "text", props: { fontSize: 42 } },
    ];
    resolveFontSizes(elements, sizeMap);
    expect(elements[0].props.fontSize).toBe(42);
  });

  test("uses default for unknown tokens", () => {
    const elements: NodeState[] = [
      { type: "text", props: { fontSize: "$unknownToken" } },
    ];
    resolveFontSizes(elements, sizeMap);
    expect(elements[0].props.fontSize).toBe(24);
  });

  test("resolves tokens in children recursively", () => {
    const elements: NodeState[] = [
      {
        type: "box",
        props: {},
        children: [
          { type: "text", props: { fontSize: "$damage" } },
          {
            type: "box",
            props: {},
            children: [
              { type: "text", props: { fontSize: "$footer" } },
            ],
          },
        ],
      },
    ];
    resolveFontSizes(elements, sizeMap);
    expect(elements[0].children![0].props.fontSize).toBe(36);
    expect(elements[0].children![1].children![0].props.fontSize).toBe(14);
  });

  test("resolves tokens in itemTemplate", () => {
    const elements: NodeState[] = [
      {
        type: "repeater",
        props: {},
        itemTemplate: {
          type: "text",
          props: { fontSize: "$attackName" },
        },
      },
    ];
    resolveFontSizes(elements, sizeMap);
    expect(elements[0].itemTemplate!.props.fontSize).toBe(28);
  });

  test("resolves tokens in nested itemTemplate children", () => {
    const elements: NodeState[] = [
      {
        type: "repeater",
        props: {},
        itemTemplate: {
          type: "box",
          props: {},
          children: [
            { type: "text", props: { fontSize: "$damage" } },
          ],
        },
      },
    ];
    resolveFontSizes(elements, sizeMap);
    expect(elements[0].itemTemplate!.children![0].props.fontSize).toBe(36);
  });

  test("ignores non-$ strings", () => {
    const elements: NodeState[] = [
      { type: "text", props: { fontSize: "notAToken" as any } },
    ];
    resolveFontSizes(elements, sizeMap);
    // Non-$ strings are left as-is
    expect(elements[0].props.fontSize).toBe("notAToken");
  });

  test("handles elements without fontSize prop", () => {
    const elements: NodeState[] = [
      { type: "image", props: { src: "energy" } },
    ];
    resolveFontSizes(elements, sizeMap);
    expect(elements[0].props.fontSize).toBeUndefined();
  });

  test("handles empty elements array", () => {
    const elements: NodeState[] = [];
    resolveFontSizes(elements, sizeMap);
    expect(elements).toEqual([]);
  });

  test("falls back to 24 when default is missing from map", () => {
    const elements: NodeState[] = [
      { type: "text", props: { fontSize: "$missing" } },
    ];
    resolveFontSizes(elements, {});
    expect(elements[0].props.fontSize).toBe(24);
  });
});

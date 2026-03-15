import { describe, test, expect } from "bun:test";
import { svgPathToTemplatePath } from "./useEditorTreeNav.js";
import type { EditorElement } from "../../shared/types/editor.js";

function getNodeChildren(node: EditorElement): EditorElement[] | undefined {
  if (node.type === "repeater") return node.itemTemplate?.children;
  return node.children;
}

describe("svgPathToTemplatePath", () => {
  // Template: content-block with abilities repeater [0], attacks repeater [1],
  // weakness row [2], rule text [3], footer text [4]
  const elements: EditorElement[] = [
    {
      type: "box", id: "content-block", props: { direction: "column", width: 700 },
      children: [
        {
          type: "repeater", props: { direction: "column" },
          bind: { items: "abilities" }, showIf: "abilities",
          itemTemplate: {
            type: "box", props: { direction: "column" },
            children: [
              { type: "box", props: { direction: "row" }, children: [
                { type: "text", props: { text: "Ability:", fontSize: 22 } },
                { type: "text", props: { text: "Name", fontSize: 22 } },
              ]},
              { type: "text", props: { text: "Effect.", fontSize: 20, wrap: 1 }, showIf: "effect" },
            ],
          },
        },
        {
          type: "repeater", props: { direction: "column" },
          bind: { items: "attacks" }, showIf: "attacks",
          itemTemplate: {
            type: "box", props: { direction: "column" },
            children: [
              { type: "box", props: { direction: "row" }, children: [
                {
                  type: "repeater", props: { direction: "row" },
                  bind: { items: "cost" },
                  itemTemplate: { type: "image", props: { src: "energy", radius: 14 } },
                },
                { type: "text", props: { text: "Attack", fontSize: 28 } },
                { type: "text", props: { text: "100", fontSize: 36 }, showIf: "damage" },
              ]},
              { type: "text", props: { text: "Effect.", fontSize: 20, wrap: 1 }, showIf: "effect" },
            ],
          },
        },
        {
          type: "box", props: { direction: "row" },
          children: [
            { type: "text", props: { text: "Weak", fontSize: 14 } },
            { type: "text", props: { text: "×2", fontSize: 22 } },
          ],
        },
        { type: "text", props: { text: "Rule text", fontSize: 16, wrap: 1 }, showIf: "_ruleText" },
        { type: "text", props: { text: "Footer", fontSize: 14 } },
      ],
    },
  ];

  test("maps attack name when both repeaters present", () => {
    // SVG indices: [1, 0, 0, 1] = attacks(1) > item(0) > row(0) > name(1)
    const path = svgPathToTemplatePath("content-block", [1, 0, 0, 1], elements, getNodeChildren);
    expect(path).toEqual(["content-block", 1, 0, 1]);
  });

  test("maps attack name when abilities is filtered (data-child-index=1 for attacks)", () => {
    // When abilities is filtered, attacks wrapper has data-child-index=1
    // SVG indices: [1, 0, 0, 1] = attacks(1) > item(0) > row(0) > name(1)
    const path = svgPathToTemplatePath("content-block", [1, 0, 0, 1], elements, getNodeChildren);
    expect(path).toEqual(["content-block", 1, 0, 1]);
    // Should NOT be ["content-block", 0, ...] (abilities!)
    expect(path[1]).toBe(1);
  });

  test("maps weakness row after repeaters", () => {
    // Weakness row has _templateIndex=2
    const path = svgPathToTemplatePath("content-block", [2], elements, getNodeChildren);
    expect(path).toEqual(["content-block", 2]);
  });

  test("maps footer text", () => {
    const path = svgPathToTemplatePath("content-block", [4], elements, getNodeChildren);
    expect(path).toEqual(["content-block", 4]);
  });

  test("maps ability element when abilities present", () => {
    // SVG indices: [0, 0, 0, 0] = abilities(0) > item(0) > row(0) > label(0)
    const path = svgPathToTemplatePath("content-block", [0, 0, 0, 0], elements, getNodeChildren);
    expect(path).toEqual(["content-block", 0, 0, 0]);
  });

  test("maps cost energy dot inside attack row", () => {
    // SVG: attacks(1) > item(0) > row(0) > cost_repeater(0) > dot(0)
    // indices: [1, 0, 0, 0, 0]
    const path = svgPathToTemplatePath("content-block", [1, 0, 0, 0, 0], elements, getNodeChildren);
    // After attacks repeater skip: [1, row(0), cost_repeater(0)]
    // cost_repeater is itself a repeater: skip dot item index
    // Result depends on whether cost repeater has children in itemTemplate
    // The cost repeater's itemTemplate is an image with no children, so path stops
    expect(path[1]).toBe(1); // attacks, NOT abilities
  });

  test("maps weakness row child text", () => {
    // SVG: weakness_row(2) > text(1)
    const path = svgPathToTemplatePath("content-block", [2, 1], elements, getNodeChildren);
    expect(path).toEqual(["content-block", 2, 1]);
  });
});

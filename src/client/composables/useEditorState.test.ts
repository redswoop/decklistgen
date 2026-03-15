import { describe, test, expect, beforeEach } from "bun:test";
import { useEditorState } from "./useEditorState.js";
import type { EditorElement } from "../../shared/types/editor.js";

describe("useEditorState", () => {
  let state: ReturnType<typeof useEditorState>;

  beforeEach(() => {
    state = useEditorState();
    // Reset all singleton state between tests
    state.elements.value = [];
    state.selectedPath.value = [];
    state.cardData.value = null;
    state.currentCardId.value = null;
    state.status.value = "Ready";
    state.serverPos.value = {};
    state.currentTemplateId.value = null;
    state.currentTemplateName.value = "";
    state.templateDirty.value = false;
  });

  describe("selectItem", () => {
    test("selects an element by id", () => {
      state.selectItem("box-1");
      expect(state.selectedElementId.value).toBe("box-1");
      expect(state.selectedChildIndex.value).toBeNull();
      expect(state.selectedGrandchildIndex.value).toBeNull();
    });

    test("selects a child", () => {
      state.selectItem("box-1", 2);
      expect(state.selectedElementId.value).toBe("box-1");
      expect(state.selectedChildIndex.value).toBe(2);
      expect(state.selectedGrandchildIndex.value).toBeNull();
    });

    test("selects a grandchild", () => {
      state.selectItem("box-1", 1, 3);
      expect(state.selectedElementId.value).toBe("box-1");
      expect(state.selectedChildIndex.value).toBe(1);
      expect(state.selectedGrandchildIndex.value).toBe(3);
    });

    test("clears selection with null", () => {
      state.selectItem("box-1", 1, 2);
      state.selectItem(null);
      expect(state.selectedElementId.value).toBeNull();
      expect(state.selectedChildIndex.value).toBeNull();
      expect(state.selectedGrandchildIndex.value).toBeNull();
    });
  });

  describe("selectPath", () => {
    test("selects by path", () => {
      state.selectPath(["box-1", 2, 0]);
      expect(state.selectedPath.value).toEqual(["box-1", 2, 0]);
      expect(state.selectedElementId.value).toBe("box-1");
      expect(state.selectedChildIndex.value).toBe(2);
      expect(state.selectedGrandchildIndex.value).toBe(0);
    });

    test("supports deep paths", () => {
      state.selectPath(["box-1", 2, 0, 1]);
      expect(state.selectedPath.value).toEqual(["box-1", 2, 0, 1]);
    });

    test("clears with empty path", () => {
      state.selectPath(["box-1", 1]);
      state.selectPath([]);
      expect(state.selectedPath.value).toEqual([]);
      expect(state.selectedElementId.value).toBeNull();
    });
  });

  describe("resolveNode", () => {
    test("resolves root element", () => {
      state.elements.value = [
        { type: "box", id: "a", props: { anchorX: 10 } },
      ];
      const resolved = state.resolveNode(["a"]);
      expect(resolved).not.toBeNull();
      expect(resolved!.node.id).toBe("a");
      expect(resolved!.isRoot).toBe(true);
    });

    test("resolves child of box", () => {
      state.elements.value = [
        {
          type: "box", id: "a", props: {},
          children: [
            { type: "text", props: { text: "hello" } },
            { type: "text", props: { text: "world" } },
          ],
        },
      ];
      const resolved = state.resolveNode(["a", 1]);
      expect(resolved!.node.props.text).toBe("world");
      expect(resolved!.isRoot).toBe(false);
      expect(resolved!.indexInSiblings).toBe(1);
    });

    test("resolves repeater itemTemplate children", () => {
      state.elements.value = [
        {
          type: "box", id: "a", props: {},
          children: [
            {
              type: "repeater", props: { direction: "column" },
              bind: { items: "attacks" },
              itemTemplate: {
                type: "box", props: { direction: "row" },
                children: [
                  { type: "text", props: { text: "name" } },
                  { type: "text", props: { text: "damage" } },
                ],
              },
            },
          ],
        },
      ];
      const resolved = state.resolveNode(["a", 0, 1]);
      expect(resolved!.node.props.text).toBe("damage");
      expect(resolved!.isRoot).toBe(false);
      expect(resolved!.indexInSiblings).toBe(1);
    });

    test("resolves deep nesting", () => {
      state.elements.value = [
        {
          type: "box", id: "a", props: {},
          children: [
            {
              type: "box", props: { direction: "row" },
              children: [
                {
                  type: "box", props: { direction: "column" },
                  children: [
                    { type: "text", props: { text: "deep" } },
                  ],
                },
              ],
            },
          ],
        },
      ];
      const resolved = state.resolveNode(["a", 0, 0, 0]);
      expect(resolved!.node.props.text).toBe("deep");
    });

    test("marks nodes inside repeater as insideRepeater", () => {
      state.elements.value = [
        {
          type: "box", id: "a", props: {},
          children: [
            {
              type: "repeater", props: { direction: "column" },
              bind: { items: "attacks" },
              itemTemplate: {
                type: "box", props: { direction: "row" },
                children: [
                  { type: "text", props: { text: "name" }, bind: { text: "name" } },
                ],
              },
            },
          ],
        },
      ];
      // The repeater itself is not inside a repeater
      const repeater = state.resolveNode(["a", 0]);
      expect(repeater!.insideRepeater).toBe(false);

      // A child of the repeater's itemTemplate IS inside a repeater
      const child = state.resolveNode(["a", 0, 0]);
      expect(child!.insideRepeater).toBe(true);
      expect(child!.node.props.text).toBe("name");
    });

    test("root element is not inside repeater", () => {
      state.elements.value = [
        { type: "box", id: "a", props: { anchorX: 10 } },
      ];
      const resolved = state.resolveNode(["a"]);
      expect(resolved!.insideRepeater).toBe(false);
    });

    test("regular nested child is not inside repeater", () => {
      state.elements.value = [
        {
          type: "box", id: "a", props: {},
          children: [
            { type: "text", props: { text: "hello" } },
          ],
        },
      ];
      const resolved = state.resolveNode(["a", 0]);
      expect(resolved!.insideRepeater).toBe(false);
    });

    test("returns context-aware propDefs for energy image child", () => {
      state.elements.value = [
        {
          type: "box", id: "a", props: {},
          children: [
            { type: "image", props: { src: "energy", energyType: "Fire" } },
          ],
        },
      ];
      const resolved = state.resolveNode(["a", 0]);
      const keys = resolved!.propDefs.map(d => d.key);
      expect(keys).toContain("energyType");
      expect(keys).toContain("radius");
      expect(keys).not.toContain("suffix");
      expect(keys).not.toContain("height");
      expect(keys).not.toContain("clipToCard");
    });

    test("returns context-aware propDefs for logo image child", () => {
      state.elements.value = [
        {
          type: "box", id: "a", props: {},
          children: [
            { type: "image", props: { src: "logo", suffix: "VSTAR" } },
          ],
        },
      ];
      const resolved = state.resolveNode(["a", 0]);
      const keys = resolved!.propDefs.map(d => d.key);
      expect(keys).toContain("suffix");
      expect(keys).toContain("height");
      expect(keys).not.toContain("energyType");
      expect(keys).not.toContain("radius");
    });

    test("returns context-aware propDefs for root image", () => {
      state.elements.value = [
        { type: "image", id: "img1", props: { src: "energy", energyType: "Fire", anchorX: 100, anchorY: 200 } },
      ];
      const resolved = state.resolveNode(["img1"]);
      const keys = resolved!.propDefs.map(d => d.key);
      expect(keys).toContain("anchorX");
      expect(keys).toContain("anchorY");
      expect(keys).toContain("energyType");
      expect(keys).not.toContain("suffix");
      expect(keys).not.toContain("clipToCard");
    });

    test("returns null for invalid path", () => {
      state.elements.value = [
        { type: "box", id: "a", props: {} },
      ];
      expect(state.resolveNode(["a", 5])).toBeNull();
      expect(state.resolveNode(["nonexistent"])).toBeNull();
      expect(state.resolveNode([])).toBeNull();
    });
  });

  describe("stripInternalProps", () => {
    test("removes _hidden and _collapsed from elements", () => {
      const input: EditorElement[] = [
        { type: "box", id: "a", props: { x: 1 }, _hidden: true, _collapsed: true },
      ];
      const result = state.stripInternalProps(input);
      expect(result[0]._hidden).toBeUndefined();
      expect(result[0]._collapsed).toBeUndefined();
      expect(result[0].props.x).toBe(1);
    });

    test("recursively strips from children", () => {
      const input: EditorElement[] = [
        {
          type: "box", id: "a", props: {},
          children: [
            { type: "text", props: { text: "hi" }, _hidden: true },
          ],
        },
      ];
      const result = state.stripInternalProps(input);
      expect(result[0].children![0]._hidden).toBeUndefined();
    });

    test("does not modify original", () => {
      const input: EditorElement[] = [
        { type: "box", id: "a", props: {}, _hidden: true },
      ];
      state.stripInternalProps(input);
      expect(input[0]._hidden).toBe(true);
    });
  });

  describe("getChildLabel", () => {
    test("text element shows quoted text", () => {
      const child: EditorElement = { type: "text", props: { text: "Hello", wrap: 0 } };
      expect(state.getChildLabel(child)).toBe('"Hello" text');
    });

    test("wrap text shows wrap suffix", () => {
      const child: EditorElement = { type: "text", props: { text: "Long desc", wrap: 1 } };
      expect(state.getChildLabel(child)).toBe('"Long desc" wrap');
    });

    test("truncates long text", () => {
      const child: EditorElement = { type: "text", props: { text: "This is a very long piece of text", wrap: 0 } };
      expect(state.getChildLabel(child)).toBe('"This is a ve..." text');
    });

    test("energy image shows type + dot", () => {
      const child: EditorElement = { type: "image", props: { src: "energy", energyType: "Fire" } };
      expect(state.getChildLabel(child)).toBe("Fire dot");
    });

    test("logo image shows suffix + logo", () => {
      const child: EditorElement = { type: "image", props: { src: "logo", suffix: "VSTAR" } };
      expect(state.getChildLabel(child)).toBe("VSTAR logo");
    });

    test("box shows direction and child count", () => {
      const child: EditorElement = {
        type: "box", props: { direction: "row" },
        children: [{ type: "text", props: { text: "a" } }],
      };
      expect(state.getChildLabel(child)).toBe("row (1)");
    });

    test("column box shows col", () => {
      const child: EditorElement = { type: "box", props: { direction: "column" }, children: [] };
      expect(state.getChildLabel(child)).toBe("col (0)");
    });

    test("bound text shows binding path", () => {
      const child: EditorElement = { type: "text", props: { text: "Attack", wrap: 0 }, bind: { text: "name" } };
      expect(state.getChildLabel(child)).toBe("{name} text");
    });

    test("bound wrap text shows binding path", () => {
      const child: EditorElement = { type: "text", props: { text: "Effect.", wrap: 1 }, bind: { text: "effect" } };
      expect(state.getChildLabel(child)).toBe("{effect} wrap");
    });

    test("bound energy shows binding path", () => {
      const child: EditorElement = { type: "image", props: { src: "energy", energyType: "Colorless" }, bind: { energyType: "$item" } };
      expect(state.getChildLabel(child)).toBe("{$item} dot");
    });

    test("bound logo shows binding path", () => {
      const child: EditorElement = { type: "image", props: { src: "logo", suffix: "V" }, bind: { suffix: "variant" } };
      expect(state.getChildLabel(child)).toBe("{variant} logo");
    });
  });

  describe("resolveBinding", () => {
    test("resolves simple path", () => {
      const data = { hp: "280" };
      expect(state.resolveBinding("hp", data)).toBe("280");
    });

    test("resolves nested path", () => {
      const data = { attacks: [{ name: "Tackle" }] };
      expect(state.resolveBinding("attacks[0].name", data)).toBe("Tackle");
    });

    test("returns undefined for missing path", () => {
      const data = { hp: "100" };
      expect(state.resolveBinding("missing.path", data)).toBeUndefined();
    });

    test("returns undefined for null data", () => {
      expect(state.resolveBinding("hp", null as unknown as Record<string, unknown>)).toBeUndefined();
    });
  });

  describe("applyBindings", () => {
    test("applies bindings from card data to children", () => {
      state.cardData.value = { hp: "120", name: "Pikachu" };
      state.elements.value = [
        {
          type: "box", id: "test", props: {},
          children: [
            { type: "text", props: { text: "placeholder" }, bind: { text: "hp" } },
          ],
        },
      ];
      state.applyBindings();
      expect(state.elements.value[0].children![0].props.text).toBe("120");
    });

    test("applies bindings to root elements", () => {
      state.cardData.value = { bgColor: "#ff0000" };
      state.elements.value = [
        {
          type: "box", id: "test", props: { fill: "" },
          bind: { fill: "bgColor" },
        },
      ];
      state.applyBindings();
      expect(state.elements.value[0].props.fill).toBe("#ff0000");
    });

    test("does NOT resolve itemTemplate bindings against root card data", () => {
      state.cardData.value = { name: "Charizard VSTAR", attacks: [{ name: "Star Blaze" }] };
      state.elements.value = [
        {
          type: "box", id: "test", props: {},
          children: [
            {
              type: "repeater", props: { direction: "column" },
              bind: { items: "attacks" },
              itemTemplate: {
                type: "box", props: { direction: "row" },
                children: [
                  { type: "text", props: { text: "default" }, bind: { text: "name" } },
                ],
              },
            },
          ],
        },
      ];
      state.applyBindings();
      // The {name} binding inside itemTemplate should NOT resolve to "Charizard VSTAR"
      // It should keep its template default, since it resolves per-item at render time
      const repeater = state.elements.value[0].children![0];
      expect(repeater.itemTemplate!.children![0].props.text).toBe("default");
    });
  });
});

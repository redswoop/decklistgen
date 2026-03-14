import { describe, test, expect, beforeEach } from "bun:test";
import { useEditorState } from "./useEditorState.js";
import type { EditorElement } from "../../shared/types/editor.js";

describe("useEditorState", () => {
  let state: ReturnType<typeof useEditorState>;

  beforeEach(() => {
    state = useEditorState();
    // Reset state between tests
    state.elements.value = [];
    state.selectedElementId.value = null;
    state.selectedChildIndex.value = null;
    state.selectedGrandchildIndex.value = null;
    state.cardData.value = null;
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
  });
});

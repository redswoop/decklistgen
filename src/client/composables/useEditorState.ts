import { ref, computed } from "vue";
import type { EditorElement, PropDef } from "../../shared/types/editor.js";
import { PROP_DEFS, SUB_PROP_DEFS } from "../../shared/constants/prop-defs.js";

// ── Module-level singleton state ──
const elements = ref<EditorElement[]>([]);
const selectedElementId = ref<string | null>(null);
const selectedChildIndex = ref<number | null>(null);
const selectedGrandchildIndex = ref<number | null>(null);
const cardData = ref<Record<string, unknown> | null>(null);
const currentCardId = ref<string | null>(null);
const status = ref("Ready");
const serverPos = ref<Record<string, { xKey: string; yKey: string; x: number; y: number }>>({});

export interface SelectedNode {
  node: EditorElement;
  propDefs: PropDef[];
  level: 0 | 1 | 2;
}

const selectedNode = computed<SelectedNode | null>(() => {
  if (!selectedElementId.value) return null;
  const el = elements.value.find((e) => e.id === selectedElementId.value);
  if (!el) return null;

  if (selectedGrandchildIndex.value != null && selectedChildIndex.value != null && el.children) {
    const child = el.children[selectedChildIndex.value];
    if (!child?.children) return null;
    const gc = child.children[selectedGrandchildIndex.value];
    if (!gc) return null;
    return { node: gc, propDefs: SUB_PROP_DEFS[gc.type] || [], level: 2 };
  }

  if (selectedChildIndex.value != null && el.children) {
    const child = el.children[selectedChildIndex.value];
    if (!child) return null;
    return { node: child, propDefs: SUB_PROP_DEFS[child.type] || [], level: 1 };
  }

  return { node: el, propDefs: PROP_DEFS[el.type] || [], level: 0 };
});

function selectItem(elementId: string | null, childIndex?: number | null, grandchildIndex?: number | null) {
  selectedElementId.value = elementId;
  selectedChildIndex.value = childIndex ?? null;
  selectedGrandchildIndex.value = grandchildIndex ?? null;
}

function resolveBinding(path: string, data: Record<string, unknown>): unknown {
  if (!data || !path) return undefined;
  const parts = path.replace(/\[/g, ".").replace(/\]/g, "").split(".");
  let val: unknown = data;
  for (const part of parts) {
    if (val == null) return undefined;
    val = (val as Record<string, unknown>)[part];
  }
  return val;
}

function applyBindingsToItem(item: EditorElement) {
  if (!item.bind || !cardData.value) return;
  for (const propKey of Object.keys(item.bind)) {
    const val = resolveBinding(item.bind[propKey], cardData.value);
    if (val !== undefined) {
      item.props[propKey] = val as string | number;
    }
  }
}

function applyBindings() {
  if (!cardData.value) return;
  for (const el of elements.value) {
    if (!el.children) continue;
    for (const child of el.children) {
      applyBindingsToItem(child);
      if (child.children) {
        for (const gc of child.children) {
          applyBindingsToItem(gc);
        }
      }
    }
  }
}

function stripInternalProps(elems: EditorElement[]): EditorElement[] {
  const clean: EditorElement[] = JSON.parse(JSON.stringify(elems));
  function walk(arr: EditorElement[]) {
    for (const item of arr) {
      delete item._hidden;
      delete item._collapsed;
      if (item.children) walk(item.children);
    }
  }
  walk(clean);
  return clean;
}

function getChildLabel(child: EditorElement): string {
  if (child.type === "text") {
    let t = String(child.props.text || "");
    if (t.length > 12) t = t.substring(0, 12) + "...";
    return `"${t}" ${Number(child.props.wrap) ? "wrap" : "text"}`;
  }
  if (child.type === "image") {
    if (String(child.props.src) === "energy") {
      return `${child.props.energyType || "?"} dot`;
    }
    return `${child.props.suffix || "?"} logo`;
  }
  if (child.type === "box") {
    const dir = String(child.props.direction || "row");
    const label = dir === "column" ? "col" : "row";
    return `${label} (${child.children ? child.children.length : 0})`;
  }
  return child.type;
}

function setStatus(msg: string) {
  status.value = msg;
}

export function useEditorState() {
  return {
    elements,
    selectedElementId,
    selectedChildIndex,
    selectedGrandchildIndex,
    cardData,
    currentCardId,
    status,
    serverPos,
    selectedNode,
    selectItem,
    applyBindings,
    resolveBinding,
    stripInternalProps,
    getChildLabel,
    setStatus,
  };
}

import { ref, computed } from "vue";
import type { EditorElement, PropDef } from "../../shared/types/editor.js";
import { PROP_DEFS, SUB_PROP_DEFS, IMAGE_SRC_DEF, IMAGE_ENERGY_DEFS, IMAGE_LOGO_DEFS, getImagePropDefs } from "../../shared/constants/prop-defs.js";
import { resolveBinding } from "../../shared/resolve-bindings.js";

// ── Module-level singleton state ──
const elements = ref<EditorElement[]>([]);
const selectedPath = ref<(string | number)[]>([]);
const cardData = ref<Record<string, unknown> | null>(null);
const currentCardId = ref<string | null>(null);
const status = ref("Ready");
const serverPos = ref<Record<string, { xKey: string; yKey: string; x: number; y: number }>>({});
const currentTemplateId = ref<string | null>(null);
const currentTemplateName = ref<string>("");
const templateDirty = ref(false);

// ── Backward compat computed refs ──
const selectedElementId = computed(() => selectedPath.value.length > 0 ? String(selectedPath.value[0]) : null);
const selectedChildIndex = computed(() => selectedPath.value.length > 1 ? Number(selectedPath.value[1]) : null);
const selectedGrandchildIndex = computed(() => selectedPath.value.length > 2 ? Number(selectedPath.value[2]) : null);

/** Get the effective children of a node (handles repeater itemTemplate). */
function getNodeChildren(node: EditorElement): EditorElement[] | undefined {
  if (node.type === "repeater") return node.itemTemplate?.children;
  return node.children;
}

export interface ResolvedNode {
  node: EditorElement;
  propDefs: PropDef[];
  isRoot: boolean;
  /** The siblings array this node belongs to (for reorder/remove). null for root. */
  siblings: EditorElement[] | null;
  /** Index within siblings. null for root. */
  indexInSiblings: number | null;
  /** Whether this node is inside a repeater's itemTemplate. */
  insideRepeater: boolean;
}

/** Walk the element tree following a path. Returns the node + context info. */
function resolveNode(path: (string | number)[]): ResolvedNode | null {
  if (path.length === 0) return null;

  const el = elements.value.find((e) => e.id === path[0]);
  if (!el) return null;

  if (path.length === 1) {
    let propDefs: PropDef[];
    if (el.type === "image") {
      const src = String(el.props.src ?? "energy");
      const typeDefs = src === "energy" ? IMAGE_ENERGY_DEFS : IMAGE_LOGO_DEFS;
      propDefs = [...PROP_DEFS.image.filter(d => d.isPosition), IMAGE_SRC_DEF, ...typeDefs];
    } else {
      propDefs = PROP_DEFS[el.type] || [];
    }
    return { node: el, propDefs, isRoot: true, siblings: null, indexInSiblings: null, insideRepeater: false };
  }

  let current: EditorElement = el;
  let insideRepeater = false;
  for (let i = 1; i < path.length; i++) {
    if (current.type === "repeater") insideRepeater = true;
    const idx = path[i] as number;
    const children = getNodeChildren(current);
    if (!children || idx >= children.length) return null;
    if (i === path.length - 1) {
      const child = children[idx];
      const propDefs = child.type === "image"
        ? getImagePropDefs(String(child.props.src ?? "energy"))
        : (SUB_PROP_DEFS[child.type] || []);
      return { node: child, propDefs, isRoot: false, siblings: children, indexInSiblings: idx, insideRepeater };
    }
    current = children[idx];
  }

  return null;
}

export interface SelectedNode {
  node: EditorElement;
  propDefs: PropDef[];
  isRoot: boolean;
  insideRepeater: boolean;
}

const selectedNode = computed<SelectedNode | null>(() => {
  const resolved = resolveNode(selectedPath.value);
  if (!resolved) return null;
  return { node: resolved.node, propDefs: resolved.propDefs, isRoot: resolved.isRoot, insideRepeater: resolved.insideRepeater };
});

function selectItem(elementId: string | null, ...indices: (number | null | undefined)[]) {
  if (!elementId) { selectedPath.value = []; return; }
  const path: (string | number)[] = [elementId];
  for (const idx of indices) {
    if (idx == null) break;
    path.push(idx);
  }
  selectedPath.value = path;
}

/** Tracks whether the last selection came from the canvas (for scroll-into-view). */
const selectionSource = ref<"tree" | "canvas" | "">("");

function selectPath(path: (string | number)[], source: "tree" | "canvas" | "" = "") {
  selectionSource.value = source;
  selectedPath.value = [...path];
}

function applyBindingsToItem(item: EditorElement) {
  if (!item.bind || !cardData.value) return;
  for (const propKey of Object.keys(item.bind)) {
    const val = resolveBinding(item.bind[propKey], cardData.value);
    if (typeof val === "string" || typeof val === "number") {
      item.props[propKey] = val;
    }
  }
}

function applyBindingsRecursive(items: EditorElement[]) {
  for (const item of items) {
    applyBindingsToItem(item);
    if (item.children) applyBindingsRecursive(item.children);
    // Note: itemTemplate bindings are NOT resolved here — they resolve
    // against per-item data at render time via resolve-bindings.ts
  }
}

function applyBindings() {
  if (!cardData.value) return;
  for (const el of elements.value) {
    applyBindingsToItem(el);
    if (el.children) applyBindingsRecursive(el.children);
  }
}

function stripInternalProps(elems: EditorElement[]): EditorElement[] {
  const clean: EditorElement[] = JSON.parse(JSON.stringify(elems));
  function walk(arr: EditorElement[]) {
    for (const item of arr) {
      delete item._hidden;
      delete item._collapsed;
      if (item.children) walk(item.children);
      if (item.itemTemplate) {
        delete item.itemTemplate._hidden;
        delete item.itemTemplate._collapsed;
        if (item.itemTemplate.children) walk(item.itemTemplate.children);
      }
    }
  }
  walk(clean);
  return clean;
}

function getChildLabel(child: EditorElement): string {
  if (child.type === "repeater") {
    const path = child.bind?.items ?? "?";
    return `repeat: ${path}`;
  }
  if (child.type === "text") {
    const suffix = Number(child.props.wrap) ? "wrap" : "text";
    const boundText = child.bind?.text;
    if (boundText) {
      return `{${boundText}} ${suffix}`;
    }
    let t = String(child.props.text || "");
    if (t.length > 12) t = t.substring(0, 12) + "...";
    return `"${t}" ${suffix}`;
  }
  if (child.type === "image") {
    const boundType = child.bind?.energyType;
    if (String(child.props.src) === "energy") {
      if (boundType) return `{${boundType}} dot`;
      return `${child.props.energyType || "?"} dot`;
    }
    const boundSuffix = child.bind?.suffix;
    if (boundSuffix) return `{${boundSuffix}} logo`;
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

function markDirty() {
  templateDirty.value = true;
}

export function useEditorState() {
  return {
    elements,
    selectedPath,
    // Backward compat computed refs
    selectedElementId,
    selectedChildIndex,
    selectedGrandchildIndex,
    cardData,
    currentCardId,
    status,
    serverPos,
    currentTemplateId,
    currentTemplateName,
    templateDirty,
    selectedNode,
    selectItem,
    selectPath,
    selectionSource,
    resolveNode,
    getNodeChildren,
    applyBindings,
    resolveBinding,
    stripInternalProps,
    getChildLabel,
    setStatus,
    markDirty,
  };
}

import { useEditorState } from "./useEditorState.js";
import { useEditorRenderer } from "./useEditorRenderer.js";
import { PROP_DEFS } from "../../shared/constants/prop-defs.js";

export function useEditorKeyboard() {
  const { elements, selectedPath, selectPath, resolveNode, getNodeChildren, serverPos, selectedElementId } = useEditorState();
  const { rerender, debouncedRerender } = useEditorRenderer();

  function onKeyDown(e: KeyboardEvent) {
    // Don't intercept when typing in inputs
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;

    if (selectedPath.value.length === 0) return;
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) return;
    e.preventDefault();

    const step = e.shiftKey ? 10 : 1;
    const resolved = resolveNode(selectedPath.value);
    if (!resolved) return;

    // ── Non-root: nudge margins or reorder ──
    if (!resolved.isRoot) {
      if ((e.ctrlKey || e.metaKey) && resolved.siblings && resolved.indexInSiblings != null) {
        const ci = resolved.indexInSiblings;
        let newIdx = ci;
        if (e.key === "ArrowLeft" && ci > 0) newIdx = ci - 1;
        if (e.key === "ArrowRight" && ci < resolved.siblings.length - 1) newIdx = ci + 1;
        if (newIdx !== ci) {
          const tmp = resolved.siblings[ci];
          resolved.siblings[ci] = resolved.siblings[newIdx];
          resolved.siblings[newIdx] = tmp;
          const newPath = [...selectedPath.value];
          newPath[newPath.length - 1] = newIdx;
          selectPath(newPath);
          rerender();
        }
        return;
      }

      const node = resolved.node;
      if (e.key === "ArrowRight") node.props.marginLeft = Number(node.props.marginLeft || 0) + step;
      if (e.key === "ArrowLeft") node.props.marginLeft = Number(node.props.marginLeft || 0) - step;
      if (e.key === "ArrowDown") node.props.marginTop = Number(node.props.marginTop || 0) + step;
      if (e.key === "ArrowUp") node.props.marginTop = Number(node.props.marginTop || 0) - step;
      debouncedRerender();
      return;
    }

    // ── Root element: move position ──
    const el = resolved.node;
    const defs = PROP_DEFS[el.type];
    if (!defs) return;
    const posKeys = defs.filter((d) => d.isPosition);
    if (posKeys.length < 2) return;
    const xKey = posKeys[0].key;
    const yKey = posKeys[1].key;

    if (e.key === "ArrowLeft") el.props[xKey] = Number(el.props[xKey]) - step;
    if (e.key === "ArrowRight") el.props[xKey] = Number(el.props[xKey]) + step;
    if (e.key === "ArrowUp") el.props[yKey] = Number(el.props[yKey]) - step;
    if (e.key === "ArrowDown") el.props[yKey] = Number(el.props[yKey]) + step;

    // Instant DOM update via transform for responsiveness
    const sp = el.id ? serverPos.value[el.id] : null;
    if (sp && selectedElementId.value) {
      const svgEl = document.querySelector("#editor-canvas-wrap svg");
      if (svgEl) {
        const g = svgEl.querySelector(`[data-element-id="${selectedElementId.value}"]`);
        if (g) {
          if (el.type === "box") {
            g.setAttribute("transform", `translate(${Number(el.props[xKey])},${Number(el.props[yKey])})`);
          } else {
            const dx = Number(el.props[xKey]) - sp.x;
            const dy = Number(el.props[yKey]) - sp.y;
            g.setAttribute("transform", `translate(${dx},${dy})`);
          }
        }
      }
    }

    debouncedRerender();
  }

  return { onKeyDown };
}

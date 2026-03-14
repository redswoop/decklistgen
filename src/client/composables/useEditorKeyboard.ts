import { useEditorState } from "./useEditorState.js";
import { useEditorRenderer } from "./useEditorRenderer.js";
import { PROP_DEFS } from "../../shared/constants/prop-defs.js";

export function useEditorKeyboard() {
  const { elements, selectedElementId, selectedChildIndex, selectedGrandchildIndex, serverPos } = useEditorState();
  const { rerender, debouncedRerender } = useEditorRenderer();

  function onKeyDown(e: KeyboardEvent) {
    // Don't intercept when typing in inputs
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;

    if (!selectedElementId.value) return;
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) return;
    e.preventDefault();

    const step = e.shiftKey ? 10 : 1;
    const el = elements.value.find((el) => el.id === selectedElementId.value);
    if (!el) return;

    // ── Grandchild selected ──
    if (selectedGrandchildIndex.value != null && selectedChildIndex.value != null && el.children) {
      const child = el.children[selectedChildIndex.value];
      if (!child?.children) return;
      const gi = selectedGrandchildIndex.value;
      const grandchild = child.children[gi];
      if (!grandchild) return;

      if (e.ctrlKey || e.metaKey) {
        let newGi = gi;
        if (e.key === "ArrowLeft" && gi > 0) newGi = gi - 1;
        if (e.key === "ArrowRight" && gi < child.children.length - 1) newGi = gi + 1;
        if (newGi !== gi) {
          const tmp = child.children[gi];
          child.children[gi] = child.children[newGi];
          child.children[newGi] = tmp;
          selectedGrandchildIndex.value = newGi;
          rerender();
        }
        return;
      }

      if (e.key === "ArrowRight") grandchild.props.marginLeft = Number(grandchild.props.marginLeft || 0) + step;
      if (e.key === "ArrowLeft") grandchild.props.marginLeft = Number(grandchild.props.marginLeft || 0) - step;
      if (e.key === "ArrowDown") grandchild.props.marginTop = Number(grandchild.props.marginTop || 0) + step;
      if (e.key === "ArrowUp") grandchild.props.marginTop = Number(grandchild.props.marginTop || 0) - step;
      debouncedRerender();
      return;
    }

    // ── Child selected ──
    if (selectedChildIndex.value != null && el.children) {
      const ci = selectedChildIndex.value;
      const child = el.children[ci];
      if (!child) return;

      if (e.ctrlKey || e.metaKey) {
        let newIdx = ci;
        if (e.key === "ArrowLeft" && ci > 0) newIdx = ci - 1;
        if (e.key === "ArrowRight" && ci < el.children.length - 1) newIdx = ci + 1;
        if (newIdx !== ci) {
          const tmp = el.children[ci];
          el.children[ci] = el.children[newIdx];
          el.children[newIdx] = tmp;
          selectedChildIndex.value = newIdx;
          rerender();
        }
        return;
      }

      if (e.key === "ArrowRight") child.props.marginLeft = Number(child.props.marginLeft || 0) + step;
      if (e.key === "ArrowLeft") child.props.marginLeft = Number(child.props.marginLeft || 0) - step;
      if (e.key === "ArrowDown") child.props.marginTop = Number(child.props.marginTop || 0) + step;
      if (e.key === "ArrowUp") child.props.marginTop = Number(child.props.marginTop || 0) - step;
      debouncedRerender();
      return;
    }

    // ── Element selected: move position ──
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
    if (sp) {
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

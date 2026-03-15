import { ref } from "vue";
import { useEditorState } from "./useEditorState.js";
import { useEditorApi } from "./useEditorApi.js";
import { applyBindingsToTree } from "../../shared/resolve-bindings.js";
import { PROP_DEFS } from "../../shared/constants/prop-defs.js";

const svgHtml = ref("");
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let needsFit = false;

export function useEditorRenderer() {
  const { elements, currentCardId, serverPos, setStatus, stripInternalProps, applyBindings, cardData } = useEditorState();
  const api = useEditorApi();
  let fitCallback: (() => void) | null = null;

  function onFit(cb: () => void) {
    fitCallback = cb;
  }

  async function loadCard(cardId: string) {
    setStatus("Loading...");
    currentCardId.value = cardId;
    needsFit = true;

    // Fetch card data for bindings
    const data = await api.fetchCardData(cardId);
    if (data) {
      cardData.value = data;
      applyBindings(); // Resolve simple bindings for properties panel display
    }

    await renderToSvg(cardId);
  }

  async function renderToSvg(cardId: string) {
    try {
      // Build render payload: strip internal props, then expand repeaters + apply bindings
      const clean = stripInternalProps(elements.value);
      const expanded = cardData.value
        ? applyBindingsToTree(clean, cardData.value)
        : clean;

      const svg = await api.renderSvg(cardId, expanded);
      svgHtml.value = svg;

      // Record server positions for instant arrow-key feedback
      const newPos: typeof serverPos.value = {};
      for (const el of elements.value) {
        const defs = PROP_DEFS[el.type];
        if (!defs) continue;
        const posKeys = defs.filter((d) => d.isPosition);
        if (posKeys.length >= 2 && el.id) {
          newPos[el.id] = {
            xKey: posKeys[0].key,
            yKey: posKeys[1].key,
            x: Number(el.props[posKeys[0].key]),
            y: Number(el.props[posKeys[1].key]),
          };
        }
      }
      serverPos.value = newPos;

      setStatus("Ready");

      if (needsFit) {
        needsFit = false;
        setTimeout(() => fitCallback?.(), 100);
      }
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  function rerender() {
    if (currentCardId.value) renderToSvg(currentCardId.value);
  }

  function debouncedRerender() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(rerender, 300);
  }

  return { svgHtml, rerender, debouncedRerender, loadCard, onFit };
}

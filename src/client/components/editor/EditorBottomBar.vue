<script setup lang="ts">
import { useEditorState } from "../../composables/useEditorState.js";

const { elements, status, stripInternalProps } = useEditorState();

function copyJson() {
  const json = JSON.stringify(stripInternalProps(elements.value), null, 2);
  navigator.clipboard.writeText(json).then(() => {
    status.value = "JSON copied";
  });
}

function copyCode() {
  if (!elements.value.length) return;
  const NL = "\n";
  const BT = "`";
  const DS = "$";
  const snippets = elements.value.map((el) => {
    if (el.type === "image" && Number(el.props.clipToCard)) {
      const p = el.props;
      return (
        `const bigLogoH = ${p.height};` + NL +
        `const [bigLogoSvg] = renderSuffixLogo("${p.suffix}", ${p.anchorX}, ${p.anchorY}, bigLogoH);` + NL +
        `lines.push(${BT}  <g opacity="${p.opacity}" clip-path="url(#card-clip)">${DS}{bigLogoSvg}</g>${BT});`
      );
    }
    return `// Element: ${el.type}${NL}${JSON.stringify(el, null, 2)}`;
  });
  navigator.clipboard.writeText(snippets.join(NL + NL)).then(() => {
    status.value = "Code copied";
  });
}
</script>

<template>
  <div class="bottom-bar">
    <button @click="copyJson">Copy JSON</button>
    <button @click="copyCode">Copy Code</button>
    <div class="status">{{ status }}</div>
  </div>
</template>

<style scoped>
.bottom-bar { padding: 8px 16px; background: #16213e; border-top: 1px solid #333; display: flex; align-items: center; gap: 8px; }
.bottom-bar button { background: #0f3460; color: #e0e0e0; border: 1px solid #444; border-radius: 4px; padding: 5px 12px; font-size: 12px; cursor: pointer; }
.bottom-bar button:hover { background: #1a5276; }
.status { flex: 1; text-align: right; font-size: 11px; color: #666; }
</style>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import EditorToolbar from "./EditorToolbar.vue";
import EditorCanvas from "./EditorCanvas.vue";
import EditorSidebar from "./EditorSidebar.vue";
import EditorBottomBar from "./EditorBottomBar.vue";
import { useEditorState } from "../../composables/useEditorState.js";
import { useEditorRenderer } from "../../composables/useEditorRenderer.js";
import { useEditorViewport } from "../../composables/useEditorViewport.js";
import { useEditorKeyboard } from "../../composables/useEditorKeyboard.js";
import type { EditorElement } from "../../../shared/types/editor.js";

const { elements } = useEditorState();
const { onFit } = useEditorRenderer();
const { zoomToFit, onSpaceDown, onSpaceUp } = useEditorViewport();
const { onKeyDown } = useEditorKeyboard();

const canvas = ref<InstanceType<typeof EditorCanvas> | null>(null);

// Initialize default elements
onMounted(() => {
  if (elements.value.length === 0) {
    elements.value = createDefaultElements();
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keydown", onSpaceDown);
  window.addEventListener("keyup", onSpaceUp);

  onFit(() => {
    zoomToFit(canvas.value?.cardsInner ?? null, canvas.value?.cardsArea ?? null);
  });
});

onUnmounted(() => {
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keydown", onSpaceDown);
  window.removeEventListener("keyup", onSpaceUp);
});

function handleFit() {
  zoomToFit(canvas.value?.cardsInner ?? null, canvas.value?.cardsArea ?? null);
}

function createDefaultElements(): EditorElement[] {
  return [
    {
      type: "image", id: "big-logo-1",
      props: { src: "logo", suffix: "VSTAR-big", height: 280, opacity: 0.85, clipToCard: 1, anchorX: -50, anchorY: -38 },
    },
    {
      type: "box", id: "hp-cluster-1",
      props: { anchorX: 514, anchorY: 42, direction: "row" },
      children: [
        { type: "text", props: { text: "HP", fontSize: 25, fontFamily: "title", fontWeight: "bold", fill: "#ffffff", opacity: 1, stroke: "", strokeWidth: 0, filter: "none", textAnchor: "start", wrap: 0, marginTop: 0, marginRight: 4, marginBottom: 4, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "bottom" }, bind: {} },
        { type: "text", props: { text: "280", fontSize: 52, fontFamily: "title", fontWeight: "bold", fill: "#ffffff", opacity: 1, stroke: "#000000", strokeWidth: 0, filter: "title-shadow", textAnchor: "start", wrap: 0, marginTop: 0, marginRight: 6, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "bottom" }, bind: { text: "hp" } },
        { type: "image", props: { src: "energy", energyType: "Fire", radius: 25, marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" }, bind: { energyType: "types[0]" } },
      ],
    },
    {
      type: "box", id: "name-cluster-1",
      props: { anchorX: 45, anchorY: 46, direction: "row" },
      children: [
        { type: "text", props: { text: "Arcanine", fontSize: 48, fontFamily: "title", fontWeight: "bold", fill: "#ffffff", opacity: 1, stroke: "#000000", strokeWidth: 2.5, filter: "title-shadow", textAnchor: "start", wrap: 0, marginTop: 0, marginRight: 0, marginBottom: 6, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "bottom" }, bind: { text: "_baseName" } },
        { type: "image", props: { src: "logo", suffix: "ex", height: 55, filter: "title-shadow", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 4, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "bottom" }, bind: { suffix: "_nameSuffix" } },
      ],
    },
    {
      type: "box", id: "evolves-from-1",
      props: { anchorX: 47, anchorY: 98, direction: "row" },
      children: [
        { type: "text", props: { text: "Evolves from", fontSize: 18, fontFamily: "body", fontWeight: "bold", fill: "#ffffff", opacity: 0.7, stroke: "", strokeWidth: 0, filter: "shadow", textAnchor: "start", wrap: 0, grow: 0, hAlign: "start", marginTop: 0, marginRight: 6, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" } },
        { type: "text", props: { text: "Growlithe", fontSize: 18, fontFamily: "title", fontWeight: "bold", fill: "#ffffff", opacity: 1, stroke: "", strokeWidth: 0, filter: "shadow", textAnchor: "start", wrap: 0, grow: 0, hAlign: "start", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" }, bind: { text: "evolveFrom" } },
      ],
    },
    {
      type: "box", id: "attack-block-1",
      props: { anchorX: 20, anchorY: 0, width: 710, direction: "column", vAnchor: "bottom", paddingTop: 4, paddingRight: 8, paddingBottom: 37, paddingLeft: 8, fill: "#e6a7a7", fillOpacity: 0.1, rx: 5 },
      children: [
        { type: "box", props: { direction: "row" }, children: [
          { type: "image", props: { src: "energy", energyType: "Fire", radius: 14, grow: 0, hAlign: "start", marginTop: 0, marginRight: 4, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" }, bind: { energyType: "attacks[0].cost[0]" } },
          { type: "image", props: { src: "energy", energyType: "Fire", radius: 14, grow: 0, hAlign: "start", marginTop: 0, marginRight: 6, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" }, bind: { energyType: "attacks[0].cost[1]" } },
          { type: "text", props: { text: "Raging Claws", fontSize: 28, fontFamily: "title", fontWeight: "bold", fill: "#ffffff", opacity: 1, stroke: "", strokeWidth: 0, filter: "shadow", textAnchor: "start", wrap: 0, grow: 1, hAlign: "start", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" }, bind: { text: "attacks[0].name" } },
          { type: "text", props: { text: "30+", fontSize: 36, fontFamily: "title", fontWeight: "bold", fill: "#cc0000", opacity: 1, stroke: "", strokeWidth: 0, filter: "shadow", textAnchor: "start", wrap: 0, grow: 0, hAlign: "end", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" }, bind: { text: "attacks[0].damage" } },
        ] },
        { type: "text", props: {
          text: "This attack does 10 more damage for each damage counter on this Pok\u00e9mon.",
          fontSize: 27, fontFamily: "body", fontWeight: "bold", fill: "#ffffff", opacity: 1, filter: "title-shadow", wrap: 1, marginTop: 4,
        }, bind: { text: "attacks[0].effect" } },
        { type: "box", props: { direction: "row", marginTop: 6 }, children: [
          { type: "image", props: { src: "energy", energyType: "Fire", radius: 14, grow: 0, hAlign: "start", marginTop: 0, marginRight: 4, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" }, bind: { energyType: "attacks[1].cost[0]" } },
          { type: "image", props: { src: "energy", energyType: "Fire", radius: 14, grow: 0, hAlign: "start", marginTop: 0, marginRight: 4, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" }, bind: { energyType: "attacks[1].cost[1]" } },
          { type: "image", props: { src: "energy", energyType: "Fire", radius: 14, grow: 0, hAlign: "start", marginTop: 0, marginRight: 6, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" }, bind: { energyType: "attacks[1].cost[2]" } },
          { type: "text", props: { text: "Bright Flame", fontSize: 28, fontFamily: "title", fontWeight: "bold", fill: "#222222", opacity: 1, stroke: "", strokeWidth: 0, filter: "shadow", textAnchor: "start", wrap: 0, grow: 1, hAlign: "start", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" }, bind: { text: "attacks[1].name" } },
          { type: "text", props: { text: "250", fontSize: 36, fontFamily: "title", fontWeight: "bold", fill: "#cc0000", opacity: 1, stroke: "", strokeWidth: 0, filter: "shadow", textAnchor: "start", wrap: 0, grow: 0, hAlign: "end", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" }, bind: { text: "attacks[1].damage" } },
        ] },
        { type: "text", props: {
          text: "Discard 2 {R} Energy from this Pok\u00e9mon.",
          fontSize: 20, fontFamily: "body", fontWeight: "bold", fill: "#222222", opacity: 1, filter: "shadow", wrap: 1, marginTop: 4,
        }, bind: { text: "attacks[1].effect" } },
        { type: "box", props: { direction: "row", marginTop: 4 }, children: [
          { type: "text", props: { text: "Weak", fontSize: 14, fontFamily: "body", fontWeight: "bold", fill: "#888888", opacity: 1, stroke: "", strokeWidth: 0, filter: "none", textAnchor: "start", wrap: 0, grow: 0, hAlign: "start", marginTop: 0, marginRight: 4, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" } },
          { type: "image", props: { src: "energy", energyType: "Lightning", radius: 12, grow: 0, hAlign: "start", marginTop: 0, marginRight: 4, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" }, bind: { energyType: "weaknesses[0].type" } },
          { type: "text", props: { text: "\u00d72", fontSize: 22, fontFamily: "body", fontWeight: "bold", fill: "#222222", opacity: 1, stroke: "", strokeWidth: 0, filter: "shadow", textAnchor: "start", wrap: 0, grow: 0, hAlign: "start", marginTop: 0, marginRight: 16, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" }, bind: { text: "weaknesses[0].value" } },
          { type: "text", props: { text: "Resist", fontSize: 14, fontFamily: "body", fontWeight: "bold", fill: "#888888", opacity: 1, stroke: "", strokeWidth: 0, filter: "none", textAnchor: "start", wrap: 0, grow: 0, hAlign: "start", marginTop: 0, marginRight: 4, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" } },
          { type: "image", props: { src: "energy", energyType: "Fighting", radius: 12, grow: 0, hAlign: "start", marginTop: 0, marginRight: 4, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" }, bind: { energyType: "resistances[0].type" } },
          { type: "text", props: { text: "-30", fontSize: 22, fontFamily: "body", fontWeight: "bold", fill: "#222222", opacity: 1, stroke: "", strokeWidth: 0, filter: "shadow", textAnchor: "start", wrap: 0, grow: 1, hAlign: "start", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" }, bind: { text: "resistances[0].value" } },
          { type: "text", props: { text: "Retreat", fontSize: 14, fontFamily: "body", fontWeight: "bold", fill: "#888888", opacity: 1, stroke: "", strokeWidth: 0, filter: "none", textAnchor: "start", wrap: 0, grow: 0, hAlign: "start", marginTop: 0, marginRight: 4, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" } },
          { type: "image", props: { src: "energy", energyType: "Colorless", radius: 12, grow: 0, hAlign: "start", marginTop: 0, marginRight: 4, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" } },
          { type: "image", props: { src: "energy", energyType: "Colorless", radius: 12, grow: 0, hAlign: "start", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" } },
        ] },
      ],
    },
  ];
}
</script>

<template>
  <div class="editor-view">
    <EditorToolbar @fit="handleFit" />
    <div class="main">
      <EditorCanvas ref="canvas" />
      <EditorSidebar />
    </div>
    <EditorBottomBar />
  </div>
</template>

<style scoped>
.editor-view { display: flex; flex-direction: column; height: 100%; background: #1a1a2e; color: #e0e0e0; }
.main { flex: 1; display: flex; overflow: hidden; }
</style>

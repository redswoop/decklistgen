<script setup lang="ts">
import { useEditorState } from "../../composables/useEditorState.js";
import TreeNode from "./TreeNode.vue";

const { elements } = useEditorState();
</script>

<template>
  <div class="element-list">
    <TreeNode
      v-for="(el, i) in elements"
      :key="el.id ?? i"
      :node="el"
      :path="[el.id!]"
      :depth="0"
    />
  </div>
</template>

<style scoped>
.element-list { padding: 0 8px; overflow-y: auto; overflow-x: hidden; flex: 1; }
</style>

<script setup lang="ts">
import { ref } from "vue";
import { useEditorState } from "../../composables/useEditorState.js";
import { useEditorApi } from "../../composables/useEditorApi.js";

const { elements, status, stripInternalProps, currentTemplateId, currentTemplateName, templateDirty, setStatus } = useEditorState();
const api = useEditorApi();

const showSaveAs = ref(false);
const saveAsId = ref("");
const saveAsName = ref("");

function copyJson() {
  const json = JSON.stringify(stripInternalProps(elements.value), null, 2);
  navigator.clipboard.writeText(json).then(() => {
    status.value = "JSON copied";
  });
}

async function onSave() {
  if (!currentTemplateId.value || !currentTemplateName.value) {
    // No template loaded — open Save As
    showSaveAs.value = true;
    return;
  }
  const ok = await api.saveTemplate({
    id: currentTemplateId.value,
    name: currentTemplateName.value,
    elements: stripInternalProps(elements.value),
  });
  if (ok) {
    templateDirty.value = false;
    setStatus("Saved");
  } else {
    setStatus("Save failed");
  }
}

function onSaveAsOpen() {
  saveAsId.value = currentTemplateId.value ?? "";
  saveAsName.value = currentTemplateName.value ?? "";
  showSaveAs.value = true;
}

async function onSaveAsSubmit() {
  const id = saveAsId.value.trim().replace(/[^a-zA-Z0-9_-]/g, "-");
  const name = saveAsName.value.trim();
  if (!id || !name) {
    setStatus("ID and name required");
    return;
  }
  const ok = await api.saveTemplate({
    id,
    name,
    elements: stripInternalProps(elements.value),
  });
  if (ok) {
    currentTemplateId.value = id;
    currentTemplateName.value = name;
    templateDirty.value = false;
    showSaveAs.value = false;
    setStatus(`Saved as: ${name}`);
  } else {
    setStatus("Save failed");
  }
}

function onSaveAsCancel() {
  showSaveAs.value = false;
}

function onSaveAsKeydown(e: KeyboardEvent) {
  if (e.key === "Enter") onSaveAsSubmit();
  else if (e.key === "Escape") onSaveAsCancel();
}
</script>

<template>
  <div class="bottom-bar">
    <button @click="onSave" :title="currentTemplateId ? 'Save template' : 'Save as new template'">Save</button>
    <button @click="onSaveAsOpen">Save As</button>
    <button @click="copyJson">Copy JSON</button>

    <div v-if="showSaveAs" class="save-as-panel">
      <label>ID:</label>
      <input
        type="text"
        v-model="saveAsId"
        placeholder="my-template"
        @keydown="onSaveAsKeydown"
      />
      <label>Name:</label>
      <input
        type="text"
        v-model="saveAsName"
        placeholder="My Template"
        @keydown="onSaveAsKeydown"
      />
      <button class="save-btn" @click="onSaveAsSubmit">Save</button>
      <button class="cancel-btn" @click="onSaveAsCancel">Cancel</button>
    </div>

    <div class="status">{{ status }}</div>
  </div>
</template>

<style scoped>
.bottom-bar { padding: 6px 12px; background: #16213e; border-top: 1px solid #333; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.bottom-bar button { background: #0f3460; color: #e0e0e0; border: 1px solid #444; border-radius: 4px; padding: 5px 12px; font-size: 12px; cursor: pointer; }
.bottom-bar button:hover { background: #1a5276; }
.status { flex: 1; text-align: right; font-size: 11px; color: #666; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.save-as-panel { display: flex; align-items: center; gap: 6px; background: #0a1e3d; padding: 6px 10px; border-radius: 4px; border: 1px solid #4a9eff; flex-wrap: wrap; }
.save-as-panel label { font-size: 11px; color: #888; }
.save-as-panel input { width: 120px; background: #0f3460; color: #e0e0e0; border: 1px solid #444; border-radius: 3px; padding: 3px 6px; font-size: 12px; min-width: 0; }
.save-btn { background: #1a5276 !important; border-color: #4a9eff !important; }
.cancel-btn { background: #3a1a1a !important; border-color: #744 !important; color: #e88 !important; }

@media (max-width: 768px) {
  .bottom-bar { padding: 6px 8px; gap: 6px; }
  .bottom-bar button { padding: 6px 10px; font-size: 12px; }
  .save-as-panel { width: 100%; }
  .save-as-panel input { flex: 1; width: auto; min-width: 80px; }
}
</style>

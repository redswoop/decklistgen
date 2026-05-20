<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useEditorState } from "../../composables/useEditorState.js";
import { useEditorApi } from "../../composables/useEditorApi.js";
import type { TemplateSetPolicy } from "../../composables/useEditorApi.js";

const {
  elements,
  status,
  stripInternalProps,
  currentTemplateId,
  currentTemplateName,
  currentSetId,
  templateDirty,
  setStatus,
} = useEditorState();
const api = useEditorApi();

const policy = ref<TemplateSetPolicy | null>(null);
const sets = ref<Awaited<ReturnType<typeof api.listSets>>>([]);

onMounted(async () => {
  const [p, s] = await Promise.all([api.getPolicy(), api.listSets()]);
  policy.value = p;
  sets.value = s;
});

const currentSet = computed(() => sets.value.find((s) => s.id === currentSetId.value));
const isBuiltin = computed(() => currentSet.value?.origin === "builtin");
const editMode = computed(() => policy.value?.builtinEditMode ?? "direct");

const canSave = computed(() => {
  if (!currentTemplateId.value) return false;
  if (isBuiltin.value && editMode.value === "locked") return false;
  return true;
});

const saveLabel = computed(() => {
  if (!isBuiltin.value) return "Save";
  if (editMode.value === "direct") return "Save to source";
  if (editMode.value === "shadow") return "Save (shadow)";
  return "Save";
});

const saveTitle = computed(() => {
  if (!currentTemplateId.value) return "Load a slot template first";
  if (!isBuiltin.value) return "Save to user set";
  if (editMode.value === "locked") return "Builtin set is locked (BUILTIN_EDIT_MODE=locked)";
  if (editMode.value === "direct") return "Write to the source file in src/server/templates/builtin/";
  if (editMode.value === "shadow") return "Create a shadow override in data/builtin-shadows/ (must be synced back to dev)";
  return "Save";
});

function copyJson() {
  const json = JSON.stringify(stripInternalProps(elements.value), null, 2);
  navigator.clipboard.writeText(json).then(() => {
    status.value = "JSON copied";
  });
}

async function onSave() {
  if (!currentTemplateId.value || !currentTemplateName.value) {
    setStatus("Load a slot first");
    return;
  }

  let confirmShadow = false;
  if (isBuiltin.value && editMode.value === "shadow") {
    const ok = window.confirm(
      `Save as a SHADOW override for builtin set "${currentSetId.value}"?\n\n` +
      `This will NOT modify the original shipped template. It will create an overlay in ` +
      `data/builtin-shadows/ that must be synced back to development.\n\n` +
      `Click OK to confirm.`,
    );
    if (!ok) return;
    confirmShadow = true;
  }

  const result = await api.saveSlotTemplate(
    currentSetId.value,
    currentTemplateId.value,
    {
      name: currentTemplateName.value,
      elements: stripInternalProps(elements.value),
    },
    { confirmShadow },
  );

  if (result.ok) {
    templateDirty.value = false;
    setStatus(`Saved (${editMode.value === "shadow" && isBuiltin.value ? "shadow" : "ok"})`);
  } else {
    setStatus(`Save failed: ${result.error ?? `HTTP ${result.status}`}`);
  }
}
</script>

<template>
  <div class="bottom-bar">
    <button
      @click="onSave"
      :disabled="!canSave"
      :title="saveTitle"
      :class="{ 'shadow-mode': isBuiltin && editMode === 'shadow' }"
    >{{ saveLabel }}</button>
    <button @click="copyJson">Copy JSON</button>

    <span v-if="currentSet?.hasShadow" class="shadow-banner" title="This builtin set has pending shadow overrides">
      ⚠ shadow pending sync
    </span>

    <div class="status">{{ status }}</div>
  </div>
</template>

<style scoped>
.bottom-bar { padding: 6px 12px; background: #16213e; border-top: 1px solid #333; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.bottom-bar button { background: #0f3460; color: #e0e0e0; border: 1px solid #444; border-radius: 4px; padding: 5px 12px; font-size: 12px; cursor: pointer; }
.bottom-bar button:hover:not(:disabled) { background: #1a5276; }
.bottom-bar button:disabled { opacity: 0.4; cursor: not-allowed; }
.bottom-bar button.shadow-mode { border-color: #c97a3a; color: #f5c896; }
.bottom-bar button.shadow-mode:hover:not(:disabled) { background: #3a2615; }
.shadow-banner { font-size: 11px; color: #f5c896; background: #3a2615; border: 1px solid #c97a3a; border-radius: 3px; padding: 2px 8px; }
.status { flex: 1; text-align: right; font-size: 11px; color: #666; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

@media (max-width: 768px) {
  .bottom-bar { padding: 6px 8px; gap: 6px; }
  .bottom-bar button { padding: 6px 10px; font-size: 12px; }
}
</style>

<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{
  initialName?: string;
  /** Dialog heading; defaults to "Save Deck". Duplicate passes "Duplicate Deck". */
  title?: string;
}>();

const emit = defineEmits<{
  save: [name: string];
  close: [];
}>();

const name = ref(props.initialName || "");

function handleSave() {
  const trimmed = name.value.trim();
  if (trimmed) emit("save", trimmed);
}
</script>

<template>
  <div class="dialog-overlay" @click="emit('close')">
    <div class="dialog save-deck-dialog" @click.stop>
      <h3>{{ title ?? "Save Deck" }}</h3>
      <input
        v-model="name"
        type="text"
        class="save-deck-input"
        placeholder="Deck name..."
        autofocus
        @keyup.enter="handleSave"
      />
      <div class="dialog-actions">
        <button class="btn-secondary" @click="emit('close')">Cancel</button>
        <button class="btn-primary" :disabled="!name.trim()" @click="handleSave">Save</button>
      </div>
    </div>
  </div>
</template>

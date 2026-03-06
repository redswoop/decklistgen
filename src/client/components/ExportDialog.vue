<script setup lang="ts">
const props = defineProps<{ text: string }>();
const emit = defineEmits<{ close: [] }>();

function handleCopy() {
  navigator.clipboard.writeText(props.text);
}

function handleDownload() {
  const blob = new Blob([props.text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "decklist.txt";
  a.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <div class="dialog-overlay" @click="emit('close')">
    <div class="dialog" @click.stop>
      <h3>Export Decklist</h3>
      <textarea :value="text" readonly />
      <div class="dialog-actions">
        <button class="btn-secondary" @click="emit('close')">Close</button>
        <button class="btn-secondary" @click="handleCopy">Copy</button>
        <button class="btn-primary" @click="handleDownload">Download</button>
      </div>
    </div>
  </div>
</template>

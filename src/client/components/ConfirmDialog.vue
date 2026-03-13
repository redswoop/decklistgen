<script setup lang="ts">
defineProps<{
  title: string;
  message: string;
  confirmLabel?: string;
  confirmDanger?: boolean;
}>();

const emit = defineEmits<{
  confirm: [];
  close: [];
}>();
</script>

<template>
  <div class="dialog-overlay" @click.self="emit('close')">
    <div class="dialog confirm-dialog">
      <h3>{{ title }}</h3>
      <p class="confirm-dialog-message">{{ message }}</p>
      <div class="dialog-actions">
        <button class="btn-secondary" @click="emit('close')">Cancel</button>
        <button
          :class="confirmDanger !== false ? 'btn-danger' : 'btn-primary'"
          @click="emit('confirm')"
        >
          {{ confirmLabel ?? 'Delete' }}
        </button>
      </div>
    </div>
  </div>
</template>

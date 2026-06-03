<script setup lang="ts">
// One swatch in the lightbox's Original / Cleaned / Proxy version strip. Owns
// the repeated wrapper (active state, click target, label); the mode-specific
// thumbnail body is passed via the default slot since each version renders
// differently (scan <img>, cleaned <img>/spinner, or CssCardRenderer).
// Styling comes from the global .lb-version* rules in styles/globals.css.
defineProps<{
  label: string;
  active: boolean;
}>();

defineEmits<{ select: [] }>();
</script>

<template>
  <div :class="['lb-version', { active }]">
    <div class="lb-version-thumb" @click="$emit('select')">
      <slot />
    </div>
    <span class="lb-version-label">{{ label }}</span>
  </div>
</template>

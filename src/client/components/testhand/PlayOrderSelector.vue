<script setup lang="ts">
// Going 1st / 2nd segmented toggle. Controlled by the parent (useHandTester owns
// playOrder + setOrder). Styling: global .thp-* rules in styles/testhand.css.
import type { PlayOrder } from "../../../shared/utils/hand-sim.js";

defineProps<{ order: PlayOrder }>();
const emit = defineEmits<{ set: [order: PlayOrder] }>();
</script>

<template>
  <div class="thp-order" role="group" aria-label="Play order">
    <button :class="['thp-seg', { active: order === 'first' }]" @click="emit('set', 'first')">Going 1st</button>
    <button :class="['thp-seg', { active: order === 'second' }]" @click="emit('set', 'second')">Going 2nd</button>
  </div>
</template>

<script setup lang="ts">
import { useDecklist } from "../composables/useDecklist.js";

const emit = defineEmits<{
  collapse: [];
  export: [];
}>();

const { items, totalCards, incrementCard, removeCard, clear } = useDecklist();
</script>

<template>
  <div class="decklist-panel">
    <div class="decklist-header">
      <h3>Decklist</h3>
      <span :style="{ fontSize: '13px', color: '#7f8fa6' }">{{ totalCards }} cards</span>
    </div>
    <div v-if="items.length > 0" class="decklist-actions">
      <button class="btn-clear" @click="clear()">Clear</button>
      <button class="btn-export" @click="emit('export')">Export</button>
    </div>
    <div class="decklist-items">
      <div v-if="items.length === 0" class="empty-state">
        Click cards to add them to your decklist.
      </div>
      <div
        v-for="item in items"
        :key="`${item.setCode}-${item.localId}`"
        class="decklist-item"
      >
        <img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.name" />
        <div
          v-else
          :style="{ width: '32px', height: '45px', background: '#0f3460', borderRadius: '3px' }"
        />
        <div class="item-info">
          <div class="item-name">{{ item.name }}</div>
          <div class="item-set">{{ item.setCode }} {{ item.localId }}</div>
        </div>
        <div class="item-controls">
          <button @click="removeCard(item.setCode, item.localId)">-</button>
          <span class="item-count">{{ item.count }}</span>
          <button @click="incrementCard(item.setCode, item.localId)">+</button>
        </div>
      </div>
    </div>
    <button class="collapse-btn" @click="emit('collapse')">Collapse &raquo;</button>
  </div>
</template>

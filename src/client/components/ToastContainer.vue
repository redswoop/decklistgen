<script setup lang="ts">
import { useToast } from "../composables/useToast.js";

const { toasts, dismiss } = useToast();
</script>

<template>
  <Teleport to="body">
    <div class="toast-container">
      <TransitionGroup name="toast">
        <div
          v-for="t in toasts"
          :key="t.id"
          :class="['toast', `toast-${t.type}`]"
          @click="dismiss(t.id)"
        >
          <span class="toast-icon">
            <template v-if="t.type === 'error'">&#x2716;</template>
            <template v-else-if="t.type === 'warning'">&#x26A0;</template>
            <template v-else>&#x2139;</template>
          </span>
          <span class="toast-message">{{ t.message }}</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-container {
  position: fixed;
  top: calc(48px + env(safe-area-inset-top, 0px));
  right: calc(16px + env(safe-area-inset-right, 0px));
  z-index: 10000;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  pointer-events: auto;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  max-width: 400px;
}

.toast-error {
  background: #3a1520;
  border: 1px solid #e94560;
  color: #f5a0b0;
}

.toast-warning {
  background: #3a2e15;
  border: 1px solid #e49021;
  color: #f5c880;
}

.toast-info {
  background: #152a3a;
  border: 1px solid #3099e1;
  color: #90c5f0;
}

.toast-icon {
  flex-shrink: 0;
  font-size: 14px;
}

.toast-message {
  line-height: 1.3;
}

/* Transitions */
.toast-enter-active {
  transition: all 0.25s ease-out;
}
.toast-leave-active {
  transition: all 0.2s ease-in;
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(40px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(40px);
}
</style>

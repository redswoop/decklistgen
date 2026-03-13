<script setup lang="ts">
import { computed } from "vue";
import { useQueueData } from "../composables/useQueue.js";
import { cardImageUrl } from "../../shared/utils/card-image-url.js";
import type { QueueJob } from "../../shared/types/queue.js";

const { runningJobs, pendingJobs, historyJobs, cancel, clearHistory } = useQueueData();

const isEmpty = computed(
  () => runningJobs.value.length === 0 && pendingJobs.value.length === 0 && historyJobs.value.length === 0,
);

function statusColor(status: QueueJob["status"]): string {
  switch (status) {
    case "running": return "var(--color-accent, #f59e0b)";
    case "completed": return "var(--color-success, #22c55e)";
    case "failed": return "var(--color-error, #ef4444)";
    default: return "var(--color-muted, #9ca3af)";
  }
}

function elapsed(job: QueueJob): string {
  const end = job.completedAt ?? Date.now();
  const start = job.startedAt ?? job.createdAt;
  const s = Math.round((end - start) / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function thumbUrl(job: QueueJob): string {
  if (!job.cardImageBase) return "";
  return cardImageUrl(job.cardImageBase, "low");
}
</script>

<template>
  <div class="queue-view">
    <div class="queue-header">
      <h2>Generation Queue</h2>
    </div>

    <div v-if="isEmpty" class="queue-empty">
      <p>No generation jobs.</p>
      <p class="queue-empty-hint">Generate a card from the lightbox to see it here.</p>
    </div>

    <template v-else>
      <!-- Running -->
      <section v-if="runningJobs.length > 0" class="queue-section">
        <h3 class="queue-section-title">Running</h3>
        <div v-for="job in runningJobs" :key="job.id" class="queue-item queue-item-running">
          <img v-if="thumbUrl(job)" :src="thumbUrl(job)" class="queue-thumb" alt="" />
          <div class="queue-thumb queue-thumb-empty" v-else />
          <div class="queue-info">
            <span class="queue-card-name">{{ job.cardName }}</span>
            <span class="queue-mode">{{ job.mode }}</span>
          </div>
          <span class="queue-badge" :style="{ background: statusColor(job.status) }">
            <span class="queue-pulse" />
            running
          </span>
          <span class="queue-elapsed">{{ elapsed(job) }}</span>
        </div>
      </section>

      <!-- Pending -->
      <section v-if="pendingJobs.length > 0" class="queue-section">
        <h3 class="queue-section-title">Pending <span class="queue-count">{{ pendingJobs.length }}</span></h3>
        <div v-for="job in pendingJobs" :key="job.id" class="queue-item">
          <img v-if="thumbUrl(job)" :src="thumbUrl(job)" class="queue-thumb" alt="" />
          <div class="queue-thumb queue-thumb-empty" v-else />
          <div class="queue-info">
            <span class="queue-card-name">{{ job.cardName }}</span>
            <span class="queue-mode">{{ job.mode }}</span>
          </div>
          <span class="queue-badge" :style="{ background: statusColor(job.status) }">pending</span>
          <button class="queue-cancel-btn" @click="cancel(job.id)" title="Cancel">&#x2715;</button>
        </div>
      </section>

      <!-- History -->
      <section v-if="historyJobs.length > 0" class="queue-section">
        <div class="queue-section-header">
          <h3 class="queue-section-title">History <span class="queue-count">{{ historyJobs.length }}</span></h3>
          <button class="queue-clear-btn" @click="clearHistory">Clear</button>
        </div>
        <div v-for="job in historyJobs" :key="job.id" class="queue-item">
          <img v-if="thumbUrl(job)" :src="thumbUrl(job)" class="queue-thumb" alt="" />
          <div class="queue-thumb queue-thumb-empty" v-else />
          <div class="queue-info">
            <span class="queue-card-name">{{ job.cardName }}</span>
            <span class="queue-mode">{{ job.mode }}</span>
            <span v-if="job.error" class="queue-error">{{ job.error }}</span>
          </div>
          <span class="queue-badge" :style="{ background: statusColor(job.status) }">{{ job.status }}</span>
          <span class="queue-elapsed">{{ elapsed(job) }}</span>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.queue-view {
  height: 100%;
  overflow-y: auto;
  padding: 1.5rem;
  max-width: 700px;
  margin: 0 auto;
}

.queue-header h2 {
  margin: 0 0 1rem;
  font-size: 1.25rem;
  font-weight: 600;
}

.queue-empty {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--color-muted, #9ca3af);
}

.queue-empty-hint {
  font-size: 0.85rem;
  margin-top: 0.5rem;
}

.queue-section {
  margin-bottom: 1.5rem;
}

.queue-section-title {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-muted, #9ca3af);
  margin: 0 0 0.5rem;
  font-weight: 600;
}

.queue-count {
  font-weight: 400;
  opacity: 0.7;
}

.queue-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.queue-section-header .queue-section-title {
  margin: 0;
}

.queue-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  background: var(--color-surface, #1e1e2e);
  margin-bottom: 0.375rem;
}

.queue-item-running {
  border-left: 3px solid var(--color-accent, #f59e0b);
}

.queue-thumb {
  width: 36px;
  height: 50px;
  object-fit: cover;
  border-radius: 3px;
  flex-shrink: 0;
}

.queue-thumb-empty {
  background: var(--color-border, #333);
}

.queue-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.queue-card-name {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.queue-mode {
  font-size: 0.75rem;
  color: var(--color-muted, #9ca3af);
}

.queue-error {
  font-size: 0.75rem;
  color: var(--color-error, #ef4444);
}

.queue-badge {
  font-size: 0.7rem;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  color: #fff;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.queue-pulse {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #fff;
  animation: pulse-glow 1.5s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}

.queue-elapsed {
  font-size: 0.75rem;
  color: var(--color-muted, #9ca3af);
  white-space: nowrap;
}

.queue-cancel-btn {
  background: none;
  border: 1px solid var(--color-border, #444);
  color: var(--color-muted, #9ca3af);
  border-radius: 4px;
  padding: 0.2rem 0.5rem;
  cursor: pointer;
  font-size: 0.75rem;
  line-height: 1;
}

.queue-cancel-btn:hover {
  color: var(--color-error, #ef4444);
  border-color: var(--color-error, #ef4444);
}

.queue-clear-btn {
  background: none;
  border: 1px solid var(--color-border, #444);
  color: var(--color-muted, #9ca3af);
  border-radius: 4px;
  padding: 0.25rem 0.75rem;
  cursor: pointer;
  font-size: 0.75rem;
}

.queue-clear-btn:hover {
  color: var(--color-text, #fff);
  border-color: var(--color-text, #ccc);
}
</style>

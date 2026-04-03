import { ref, computed, watch, type Ref } from "vue";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { api } from "../lib/client.js";
import { useAuth } from "./useAuth.js";
import type { QueueJob } from "../../shared/types/queue.js";
import { onGenerationCompleted, onGenerationFailed, hasActiveGenerations } from "./usePokeproxy.js";

// Module-level state for badge (accessible without full composable mount)
const activeJobCount = ref(0);
const _lastCompletedIds = new Set<string>();

/** Lightweight badge export — no polling, just reads the count */
export function useQueueBadge() {
  return { activeJobCount };
}

// Module-level refs shared between useQueue() and QueueView props
const _jobs = ref<QueueJob[]>([]);
const _runningJobs = computed(() => _jobs.value.filter((j) => j.status === "running"));
const _pendingJobs = computed(() => _jobs.value.filter((j) => j.status === "pending"));
const _historyJobs = computed(() => _jobs.value.filter((j) => j.status === "completed" || j.status === "failed"));

let _initialized = false;
let _refetchFn: (() => void) | null = null;

/**
 * Instantiate queue polling at the app level. Call once from App.vue.
 * `isActive` should be true when the queue tab is visible (faster polling).
 */
export function useQueue(isActive: Ref<boolean>) {
  const queryClient = useQueryClient();
  const { isLoggedIn } = useAuth();

  const { data, refetch } = useQuery({
    queryKey: ["queue"],
    queryFn: async () => {
      const result = await api.queueList();
      return result.jobs;
    },
    enabled: isLoggedIn,
    refetchInterval: computed(() => {
      if (!isLoggedIn.value) return false;
      if (isActive.value) return 2000;
      if (activeJobCount.value > 0 || hasActiveGenerations.value) return 5000;
      return false;
    }),
  });

  _refetchFn = () => refetch();

  // Sync module-level state whenever data changes
  watch(data, (list) => {
    _jobs.value = list ?? [];
  }, { immediate: true });

  // Update active count + detect completions whenever jobs change
  watch(_jobs, (list) => {
    activeJobCount.value = list.filter(
      (j) => j.status === "pending" || j.status === "running",
    ).length;

    // Detect newly completed or failed jobs
    for (const job of list) {
      if (job.status === "completed" && !_lastCompletedIds.has(job.id)) {
        _lastCompletedIds.add(job.id);
        onGenerationCompleted(job.cardId, queryClient);
      } else if (job.status === "failed" && !_lastCompletedIds.has(job.id)) {
        _lastCompletedIds.add(job.id);
        onGenerationFailed(job.cardId, job.error);
      }
    }

    // Clean up tracking set — only keep IDs still in the list
    const currentIds = new Set(list.map((j) => j.id));
    for (const id of _lastCompletedIds) {
      if (!currentIds.has(id)) _lastCompletedIds.delete(id);
    }
  }, { immediate: true });

  _initialized = true;

  return {
    jobs: _jobs,
    runningJobs: _runningJobs,
    pendingJobs: _pendingJobs,
    historyJobs: _historyJobs,
    cancel,
    clearHistory,
    refetch,
  };
}

async function cancel(jobId: string) {
  await api.queueCancel(jobId);
  _refetchFn?.();
}

async function clearHistory() {
  await api.queueClear();
  _refetchFn?.();
}

/** Read-only access to queue data for presentational components (QueueView). */
export function useQueueData() {
  return {
    jobs: _jobs,
    runningJobs: _runningJobs,
    pendingJobs: _pendingJobs,
    historyJobs: _historyJobs,
    cancel,
    clearHistory,
  };
}

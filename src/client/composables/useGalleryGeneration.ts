import { ref, type Ref } from "vue";
import { api } from "../lib/client.js";
import type { GalleryCardWithSource } from "./useGalleryCardSource.js";

/**
 * Single-card ComfyUI clean/expand + prompt save for the gallery inspector.
 * Owns the per-card busy/status refs. Network + polling bound — exercised
 * manually / via the inspector e2e, not unit-tested. `refetch` reloads the grid
 * and `imageCacheBust` is bumped so the just-cleaned PNG refetches.
 */
export function useGalleryGeneration(
  activeCard: Ref<GalleryCardWithSource | null>,
  refetch: () => Promise<void>,
  imageCacheBust: Ref<number>,
) {
  const busy = ref(false);
  const status = ref("");
  const promptSaveStatus = ref("");

  function resetStatus() {
    status.value = "";
    promptSaveStatus.value = "";
  }

  async function pollJob(jobId: string): Promise<void> {
    while (true) {
      await new Promise((r) => setTimeout(r, 2000));
      const job = await api.queueGet(jobId);
      if (job.status === "completed") return;
      if (job.status === "failed") throw new Error(job.error || "Generation failed");
      if (job.status === "running") status.value = "ComfyUI generating...";
    }
  }

  async function doClean(force: boolean) {
    if (!activeCard.value || busy.value) return;
    const card = activeCard.value;
    const isStandard = !card.isFullArt;
    busy.value = true;
    status.value = force
      ? (isStandard ? "Re-expanding (random seed)..." : "Force re-cleaning...")
      : (isStandard ? "Expanding via ComfyUI..." : "Cleaning via ComfyUI...");

    try {
      const data = await api.pokeproxyGenerate(card.cardId, force);
      if (data.status === "queued") {
        status.value = "Queued — waiting for ComfyUI...";
        await pollJob(data.jobId);
      }
      status.value = "Done — refreshing...";
      // Clean updates only this card's PNG; the grid as a whole stays cached.
      imageCacheBust.value = Date.now();
      await refetch();
      status.value = "Done";
    } catch (e) {
      status.value = `Error: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
      busy.value = false;
    }
  }

  async function savePrompt(text: string) {
    const card = activeCard.value;
    if (!card) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    promptSaveStatus.value = "Saving...";
    try {
      await api.pokeproxySavePrompt(card.cardId, trimmed);
      promptSaveStatus.value = "Saved";
      card.promptText = trimmed;
      card.promptRule = `card:${card.cardId}`;
    } catch (e) {
      promptSaveStatus.value = `Error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  return { busy, status, promptSaveStatus, resetStatus, doClean, savePrompt };
}

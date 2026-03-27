/**
 * In-memory generation queue. No persistence — server restart clears it.
 *
 * Single-threaded worker: one ComfyUI job at a time, FIFO order.
 */

import { existsSync, readFileSync } from "node:fs";
import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { cleanCardImage } from "./comfyui.js";
import { getCard, loadSet, isSetLoaded } from "./card-store.js";
import { getPromptForCard } from "./prompt-db.js";
import { isFullArt } from "../../shared/utils/detect-fullart.js";
import { cardImageUrl } from "../../shared/utils/card-image-url.js";
import { REVERSE_SET_MAP } from "../../shared/constants/set-codes.js";
import type { QueueJob, GenMode } from "../../shared/types/queue.ts";
import type { TcgdexCard } from "../../shared/types/card.js";

const CACHE_DIR = join(import.meta.dir, "../../../cache");
const MAX_HISTORY = 50;

const FULLART_DEFAULT_PROMPT =
  "Expand the illustration from the reference image into a large, detailed scene. " +
  "Remove all text, headers, and other non-illustrative elements.";

// --- State ---

const jobs = new Map<string, QueueJob>();
const pendingQueue: string[] = [];
let processing = false;
let _seqCounter = 0;
// Internal map for ordering — createdAt may collide within same ms
const _seqMap = new Map<string, number>();

// --- Helpers ---

function cachePath(cardId: string, suffix: string): string {
  return join(CACHE_DIR, `${cardId}${suffix}`);
}

function hasFile(cardId: string, suffix: string): boolean {
  return existsSync(cachePath(cardId, suffix));
}

function loadCardData(cardId: string): Record<string, unknown> {
  const jsonPath = cachePath(cardId, ".json");
  if (existsSync(jsonPath)) {
    try {
      return JSON.parse(readFileSync(jsonPath, "utf-8"));
    } catch {}
  }
  const card = getCard(cardId);
  if (!card) return { id: cardId };
  return {
    id: card.id,
    localId: card.localId,
    name: card.name,
    category: card.category,
    hp: card.hp,
    types: card.energyTypes,
    stage: card.stage,
    retreat: card.retreat,
    rarity: card.rarity,
    trainerType: card.trainerType,
    set: { name: card.setName, id: card.setId },
  };
}

async function ensureCardLoaded(cardId: string): Promise<void> {
  if (getCard(cardId)) return;
  const setId = cardId.replace(/-[^-]+$/, "");
  const setCode = REVERSE_SET_MAP[setId];
  if (setCode && !isSetLoaded(setCode)) {
    await loadSet(setCode);
  }
}

async function ensureSourceImage(cardId: string): Promise<boolean> {
  const srcPath = cachePath(cardId, ".png");
  if (existsSync(srcPath)) return true;

  await ensureCardLoaded(cardId);
  const card = getCard(cardId);
  if (!card?.imageBase) return false;

  const imageUrl = cardImageUrl(card.imageBase, "high");
  const resp = await fetch(imageUrl, { headers: { "User-Agent": "DecklistGen/1.0" } });
  if (!resp.ok) return false;

  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(srcPath, Buffer.from(await resp.arrayBuffer()));
  return true;
}

function pruneHistory() {
  const finished = listJobs().filter(
    (j) => j.status === "completed" || j.status === "failed",
  );
  if (finished.length <= MAX_HISTORY) return;
  // finished is newest-first from listJobs, so slice from the end
  const toPrune = finished.slice(MAX_HISTORY);
  for (const j of toPrune) {
    jobs.delete(j.id);
  }
}

// --- Public API ---

export interface SubmitOpts {
  cardId: string;
  cardName: string;
  cardImageBase: string;
  mode: GenMode;
  force: boolean;
  seed: number;
  prompt?: string;
  ruleName?: string;
  submittedBy: string;
}

export function submitJob(opts: SubmitOpts): QueueJob {
  // Dedup: same cardId+mode already pending → return existing
  for (const id of pendingQueue) {
    const existing = jobs.get(id);
    if (existing && existing.cardId === opts.cardId && existing.mode === opts.mode) {
      return existing;
    }
  }

  const id = crypto.randomUUID();
  const job: QueueJob = {
    id,
    cardId: opts.cardId,
    cardName: opts.cardName,
    cardImageBase: opts.cardImageBase,
    status: "pending",
    mode: opts.mode,
    force: opts.force,
    seed: opts.seed,
    prompt: opts.prompt,
    ruleName: opts.ruleName,
    createdAt: Date.now(),
    submittedBy: opts.submittedBy,
  };

  jobs.set(id, job);
  _seqMap.set(id, ++_seqCounter);
  pendingQueue.push(id);
  pruneHistory();

  // Kick the worker (non-blocking)
  if (_autoProcess) void processNext();

  return job;
}

export function listJobs(): QueueJob[] {
  return Array.from(jobs.values()).sort(
    (a, b) => (_seqMap.get(b.id) ?? 0) - (_seqMap.get(a.id) ?? 0),
  );
}

export function getJob(id: string): QueueJob | undefined {
  return jobs.get(id);
}

export function cancelJob(id: string): boolean {
  const job = jobs.get(id);
  if (!job || job.status !== "pending") return false;
  const idx = pendingQueue.indexOf(id);
  if (idx !== -1) pendingQueue.splice(idx, 1);
  jobs.delete(id);
  return true;
}

export function clearCompleted(): number {
  let count = 0;
  for (const [id, job] of jobs) {
    if (job.status === "completed" || job.status === "failed") {
      jobs.delete(id);
      count++;
    }
  }
  return count;
}

// --- Worker ---

async function executeGeneration(job: QueueJob): Promise<void> {
  const { cardId, mode, seed, force } = job;

  // Ensure source image
  if (!hasFile(cardId, ".png")) {
    if (!(await ensureSourceImage(cardId))) {
      throw new Error(`Card not loaded or has no image: ${cardId}`);
    }
  }

  // Read source image
  const srcData = await readFile(cachePath(cardId, ".png"));

  // Load card data for prompt resolution and crop decision
  await ensureCardLoaded(cardId);
  const cardData = loadCardData(cardId);

  // Crop for standard cards
  const fullart = isFullArt(cardData as TcgdexCard);
  let inputBase64 = srcData.toString("base64");
  if (!fullart) {
    try {
      const { width, height } = await sharp(srcData).metadata();
      if (width && height) {
        const crop = {
          left: Math.round((width * 45) / 600),
          top: Math.round((height * 110) / 825),
          width: Math.round((width * 510) / 600),
          height: Math.round((height * 320) / 825),
        };
        const cropped = await sharp(srcData).extract(crop).png().toBuffer();
        inputBase64 = cropped.toString("base64");
      }
    } catch (e: any) {
      console.error(`[gen-queue] Art crop failed for ${cardId}, using full image:`, e.message);
    }
  }

  // Use the prompt already resolved at submission time
  const prompt = job.prompt || FULLART_DEFAULT_PROMPT;

  // Call ComfyUI
  const cleanBase64 = await cleanCardImage(inputBase64, seed, prompt);

  // Write outputs
  const cleanBuffer = Buffer.from(cleanBase64, "base64");
  await mkdir(CACHE_DIR, { recursive: true });
  const writes: Promise<void>[] = [];
  const meta = JSON.stringify(
    { prompt, rule: job.ruleName, seed, timestamp: new Date().toISOString(), cardId, mode },
    null,
    2,
  );

  if (mode === "fullart") {
    writes.push(
      writeFile(cachePath(cardId, "_fullart.png"), cleanBuffer),
      writeFile(cachePath(cardId, "_fullart_meta.json"), meta),
    );
  } else {
    writes.push(
      writeFile(cachePath(cardId, "_clean.png"), cleanBuffer),
      writeFile(cachePath(cardId, "_composite.png"), cleanBuffer),
      writeFile(cachePath(cardId, "_clean_meta.json"), meta),
    );
    if (hasFile(cardId, ".svg")) {
      writes.push(unlink(cachePath(cardId, ".svg")));
    }
  }
  await Promise.all(writes);
}

async function processNext(): Promise<void> {
  if (processing) return;
  if (pendingQueue.length === 0) return;

  processing = true;
  const jobId = pendingQueue.shift()!;
  const job = jobs.get(jobId);

  if (!job) {
    processing = false;
    return processNext();
  }

  job.status = "running";
  job.startedAt = Date.now();

  try {
    await executeGeneration(job);
    job.status = "completed";
    job.completedAt = Date.now();
  } catch (e: any) {
    job.status = "failed";
    job.completedAt = Date.now();
    job.error = e.message || "Unknown error";
    console.error(`[gen-queue] Job ${jobId} failed for ${job.cardId}:`, e);
  }

  processing = false;
  pruneHistory();

  // Process next if any
  if (pendingQueue.length > 0) {
    void processNext();
  }
}

// --- Testing helpers ---

let _autoProcess = true;

export function _resetForTests() {
  jobs.clear();
  pendingQueue.length = 0;
  processing = false;
  _seqCounter = 0;
  _seqMap.clear();
  _autoProcess = false; // Tests must explicitly call processNext if they want processing
}

export function _setAutoProcess(v: boolean) {
  _autoProcess = v;
}

export function _getState() {
  return { jobs, pendingQueue, processing };
}

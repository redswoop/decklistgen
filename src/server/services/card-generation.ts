import { existsSync, readFileSync, statSync } from "node:fs";
import { getCard } from "./card-store.js";
import { submitJob, type SubmitOpts } from "./gen-queue.js";
import { getPromptForCard } from "./prompt-db.js";
import { cachePath, ensureCardLoaded, loadCardData, resolveArtFile } from "./pokeproxy/cache.js";
import type { GenMode } from "../../shared/types/queue.js";

/**
 * Card-art generation plumbing shared by the REST route (/api/pokeproxy) and
 * the MCP tools: what art exists for a card, and how a generate request turns
 * into a queue job (prompt resolution, skip rules, staleness check).
 */

export const FULLART_DEFAULT_PROMPT =
  "Expand the illustration from the reference image into a large, detailed scene. " +
  "Remove all text, headers, and other non-illustrative elements.";

export function hasArtFile(cardId: string, suffix: string): boolean {
  return resolveArtFile(cardId, suffix) !== undefined;
}

export interface ArtStatus {
  hasClean: boolean;
  hasComposite: boolean;
  hasFullart: boolean;
  mtime?: number;
}

export function getArtStatus(cardId: string): ArtStatus {
  const hasClean = hasArtFile(cardId, "_clean.png");
  const hasComposite = hasArtFile(cardId, "_composite.png");
  let mtime = 0;
  if (hasComposite) {
    try { mtime = Math.max(mtime, statSync(cachePath(cardId, "_composite.png")).mtimeMs); } catch {}
  }
  if (hasClean) {
    try { mtime = Math.max(mtime, statSync(resolveArtFile(cardId, "_clean.png")!).mtimeMs); } catch {}
  }
  return { hasClean, hasComposite, hasFullart: hasArtFile(cardId, "_fullart.png"), mtime: mtime || undefined };
}

export interface GenerateRequest {
  cardId: string;
  mode: GenMode;
  force: boolean;
  seed?: number;
  promptOverride?: string;
  submittedBy: string;
}

export type GenerateOutcome =
  | { cardId: string; status: "queued"; jobId: string }
  | { cardId: string; status: "already_exists" }
  | { cardId: string; status: "skipped"; rule: string }
  | { cardId: string; status: "no_prompt"; rule: string };

/** Resolve the prompt for a card and queue a generation job (or explain why not). */
export async function queueCardGeneration(req: GenerateRequest): Promise<GenerateOutcome> {
  const { cardId, mode, force } = req;
  const seed =
    req.seed !== undefined
      ? Math.max(0, Math.min(999999999, req.seed))
      : force
        ? Math.floor(Math.random() * 999999)
        : 42;

  const cardData = loadCardData(cardId);
  let prompt: string;
  let ruleName: string;

  if (req.promptOverride) {
    prompt = req.promptOverride;
    ruleName = "manual-override";
  } else {
    const result = getPromptForCard(cardData);
    if (mode === "fullart") {
      prompt = result.prompt || FULLART_DEFAULT_PROMPT;
      ruleName = result.skip ? "fullart-default" : result.ruleName;
    } else {
      if (result.skip) return { cardId, status: "skipped", rule: result.ruleName };
      if (!result.prompt) return { cardId, status: "no_prompt", rule: result.ruleName };
      prompt = result.prompt;
      ruleName = result.ruleName;
    }
  }

  const existsSuffix = mode === "fullart" ? "_fullart.png" : "_composite.png";
  if (!force && hasArtFile(cardId, existsSuffix)) {
    const metaSuffix = mode === "fullart" ? "_fullart_meta.json" : "_clean_meta.json";
    const metaPath = cachePath(cardId, metaSuffix);
    let stale = false;
    if (existsSync(metaPath)) {
      try {
        const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
        if (meta.rule !== ruleName || meta.prompt !== prompt) stale = true;
      } catch {}
    }
    if (!stale) return { cardId, status: "already_exists" };
  }

  await ensureCardLoaded(cardId);
  const card = getCard(cardId);
  const opts: SubmitOpts = {
    cardId,
    cardName: card?.name || cardId,
    cardImageBase: card?.imageBase || "",
    mode,
    force,
    seed,
    prompt,
    ruleName,
    submittedBy: req.submittedBy,
  };
  const job = submitJob(opts);
  return { cardId, status: "queued", jobId: job.id };
}

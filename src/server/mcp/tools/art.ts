import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDeck } from "../../services/deck-store.js";
import { getArtStatus, queueCardGeneration } from "../../services/card-generation.js";
import { listJobs, getJob, cancelJob } from "../../services/gen-queue.js";
import { ping as comfyPing } from "../../services/comfyui.js";
import { logAction } from "../../services/logger.js";
import { isValidCardId } from "../../../shared/validation.js";
import { asJson } from "../util.js";
import { effectiveUserId, requireUser, requireAuthorizedUser, fail, type McpContext } from "../context.js";

/**
 * Artwork tools: what cleaned / full-art renders exist for a deck's printings,
 * queue the missing ones on ComfyUI (the "Generate" action), and watch the queue.
 */

const actAs = z.string().optional().describe("Admin only: operate on this user's decks instead of your own.");
const mode = z.enum(["clean", "fullart"]).default("clean").describe("'clean' strips text for a composited proxy; 'fullart' expands the illustration.");

export function registerArtTools(server: McpServer, ctx: McpContext): void {
  server.registerTool(
    "deck_art_status",
    {
      title: "Deck artwork status",
      description:
        "For each distinct printing in a deck, whether cleaned (text-stripped) and full-art renders exist in the cache. " +
        "Use it to see what generate_deck_art would do.",
      inputSchema: { deckId: z.string(), actAsUserId: actAs },
    },
    async ({ deckId, actAsUserId }) => {
      const u = effectiveUserId(ctx, actAsUserId);
      if (!u.ok) return u.result;
      const deck = await getDeck(deckId, u.value);
      if (!deck) return fail(`Deck not found: ${deckId}`);
      const seen = new Set<string>();
      const cards = [];
      for (const e of deck.cards) {
        const id = e.artCard?.id ?? e.card.id;
        if (seen.has(id)) continue;
        seen.add(id);
        cards.push({ cardId: id, name: e.card.name, count: e.count, ...getArtStatus(id) });
      }
      const missingClean = cards.filter((c) => !c.hasComposite).length;
      return asJson({ deckId, name: deck.name, printings: cards.length, missingClean, missingFullart: cards.filter((c) => !c.hasFullart).length, cards });
    },
  );

  server.registerTool(
    "generate_deck_art",
    {
      title: "Generate artwork for a deck",
      description:
        "Queue ComfyUI generation jobs for a deck's printings (requires an authorized account and a reachable ComfyUI). " +
        "Default queues only printings with no render yet; force=true regenerates everything with fresh seeds. " +
        "Returns per-card outcomes: queued / already_exists / skipped (rule says don't clean this card) / no_prompt. " +
        "Poll get_generation_queue for progress.",
      inputSchema: {
        deckId: z.string(),
        mode,
        force: z.boolean().default(false),
        cardIds: z.array(z.string()).optional().describe("Restrict to these printings (default: every printing in the deck)."),
        actAsUserId: actAs,
      },
    },
    async ({ deckId, mode, force, cardIds, actAsUserId }) => {
      const auth = requireAuthorizedUser(ctx);
      if (!auth.ok) return auth.result;
      const u = effectiveUserId(ctx, actAsUserId);
      if (!u.ok) return u.result;
      const deck = await getDeck(deckId, u.value);
      if (!deck) return fail(`Deck not found: ${deckId}`);
      if (!(await comfyPing())) return fail("ComfyUI is not reachable — nothing queued. Check proxy_status.");

      const restrict = cardIds ? new Set(cardIds) : null;
      const seen = new Set<string>();
      const outcomes = [];
      for (const e of deck.cards) {
        const id = e.artCard?.id ?? e.card.id;
        if (seen.has(id) || (restrict && !restrict.has(id)) || !isValidCardId(id)) continue;
        seen.add(id);
        outcomes.push(await queueCardGeneration({ cardId: id, mode, force, submittedBy: `${auth.value.displayName || auth.value.email} (mcp)` }));
      }
      logAction("proxy.generate", "mcp", { deckId, mode, force, count: outcomes.filter((o) => o.status === "queued").length });
      const tally = outcomes.reduce<Record<string, number>>((acc, o) => ((acc[o.status] = (acc[o.status] ?? 0) + 1), acc), {});
      return asJson({ deckId, mode, tally, outcomes });
    },
  );

  server.registerTool(
    "get_generation_queue",
    {
      title: "Generation queue",
      description: "List ComfyUI generation jobs (newest first) with status, or one job by id.",
      inputSchema: { jobId: z.string().optional() },
    },
    async ({ jobId }) => {
      const r = requireUser(ctx);
      if (!r.ok) return r.result;
      if (jobId) {
        const job = getJob(jobId);
        return job ? asJson(job) : fail(`Job not found: ${jobId}`);
      }
      const jobs = listJobs();
      const tally = jobs.reduce<Record<string, number>>((acc, j) => ((acc[j.status] = (acc[j.status] ?? 0) + 1), acc), {});
      return asJson({ tally, jobs });
    },
  );

  server.registerTool(
    "cancel_generation_job",
    {
      title: "Cancel a queued generation job",
      description: "Cancel a pending generation job (running/finished jobs can't be cancelled).",
      inputSchema: { jobId: z.string() },
    },
    async ({ jobId }) => {
      const auth = requireAuthorizedUser(ctx);
      if (!auth.ok) return auth.result;
      return asJson({ ok: cancelJob(jobId), jobId });
    },
  );
}

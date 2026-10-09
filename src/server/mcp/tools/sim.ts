import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDeck } from "../../services/deck-store.js";
import { runDeckHandSim, runDeckSetupSim } from "../../services/deck-sim.js";
import { asJson } from "../util.js";
import { effectiveUserId, fail, type McpContext } from "../context.js";

/**
 * Simulator tools. Both run the same pure engines the client uses (Deck → Test
 * Hand, Deck → Setup Sim) and return the raw statistics plus an
 * `interpretation` array of plain-language takeaways.
 */

const actAs = z.string().optional().describe("Admin only: operate on this user's decks instead of your own.");
const order = z.enum(["first", "second"]).default("first").describe("Going first (draw 0 on T1) or second (draw 1 on T1).");

export function registerSimTools(server: McpServer, ctx: McpContext): void {
  server.registerTool(
    "simulate_opening_hands",
    {
      title: "Simulate opening hands",
      description:
        "Monte-Carlo opening-hand statistics for a deck: mulligan rate, odds of Basic + Supporter, " +
        "'no Supporter or Item' rate, and per-card / per-category odds of having seen a card by turn N " +
        "(closed-form hypergeometric). Returns the numbers and a plain-language interpretation.",
      inputSchema: {
        deckId: z.string(),
        order,
        iterations: z.number().int().min(100).max(50000).default(10000),
        turns: z.number().int().min(1).max(10).default(5),
        seed: z.number().int().optional().describe("Fix the RNG for reproducible numbers."),
        actAsUserId: actAs,
      },
    },
    async ({ deckId, order, iterations, turns, seed, actAsUserId }) => {
      const u = effectiveUserId(ctx, actAsUserId);
      if (!u.ok) return u.result;
      const deck = await getDeck(deckId, u.value);
      if (!deck) return fail(`Deck not found: ${deckId}`);
      const report = runDeckHandSim(deck.cards, { order, iterations, turns, seed });
      return asJson({ deckId, name: deck.name, ...report });
    },
  );

  server.registerTool(
    "simulate_setup",
    {
      title: "Simulate setup speed",
      description:
        "Monte-Carlo 'turns to set up' for every evolution line in a deck (goldfish: no opponent). " +
        "Per line: cumulative odds the final stage is in play by turn N with 95% CIs, average setup turn, " +
        "never-set-up rate, and whether the line is structurally impossible (missing Basic / Stage 1 / Rare Candy). " +
        "Trainer and ability effects are inferred from printed text. Pass lineIds (final Pokémon names) to " +
        "restrict to specific lines. Slow-ish: a few seconds for a full deck.",
      inputSchema: {
        deckId: z.string(),
        order,
        turns: z.number().int().min(1).max(8).default(5),
        iterations: z.number().int().min(300).max(12000).default(3000).describe("Baseline games per line; auto-scales up until the CI is tight."),
        seed: z.number().int().optional(),
        lineIds: z.array(z.string()).optional().describe("Final-stage Pokémon names to simulate, e.g. ['Charizard ex']."),
        actAsUserId: actAs,
      },
    },
    async ({ deckId, order, turns, iterations, seed, lineIds, actAsUserId }) => {
      const u = effectiveUserId(ctx, actAsUserId);
      if (!u.ok) return u.result;
      const deck = await getDeck(deckId, u.value);
      if (!deck) return fail(`Deck not found: ${deckId}`);
      const report = await runDeckSetupSim(deck.cards, { order, turns, iterations, seed, lineIds });
      return asJson({ deckId, name: deck.name, ...report });
    },
  );
}

import { Hono } from "hono";
import type { DecklistEntry, DecklistOutput } from "../../shared/types/decklist.js";

const app = new Hono();

app.post("/generate", async (c) => {
  const body = await c.req.json<{ entries: DecklistEntry[] }>();
  const { entries } = body;

  if (!entries?.length) return c.json({ error: "No entries" }, 400);

  const lines = entries.map((e) => `${e.setCode} ${e.localId} x${e.count}  # ${e.name}`);
  const output: DecklistOutput = { text: lines.join("\n"), entries };
  return c.json(output);
});

export default app;

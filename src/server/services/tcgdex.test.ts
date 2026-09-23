import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fetchCard, isIncompleteCard, resetStaleRefreshTracking } from "./tcgdex.js";

describe("isIncompleteCard", () => {
  test("a Stage 1/2 Pokémon with no evolveFrom is incomplete", () => {
    expect(isIncompleteCard({ category: "Pokemon", stage: "Stage1" })).toBe(true);
    expect(isIncompleteCard({ category: "Pokemon", stage: "Stage2", evolveFrom: null })).toBe(true);
    expect(isIncompleteCard({ category: "Pokemon", stage: "Stage2", evolveFrom: "" })).toBe(true);
  });

  test("Basics, Trainers, Energy, and filled-in evolutions are complete", () => {
    expect(isIncompleteCard({ category: "Pokemon", stage: "Basic" })).toBe(false);
    expect(isIncompleteCard({ category: "Pokemon", stage: "Stage1", evolveFrom: "Dreepy" })).toBe(false);
    expect(isIncompleteCard({ category: "Trainer" })).toBe(false);
    expect(isIncompleteCard({ category: "Energy" })).toBe(false);
    expect(isIncompleteCard(null)).toBe(false);
  });
});

describe("fetchCard stale-cache refresh", () => {
  const stale = { id: "zz01-001", localId: "001", name: "Drakloak", category: "Pokemon", stage: "Stage1" };
  const fresh = { ...stale, evolveFrom: "Dreepy" };
  let dir: string;
  let calls: string[];
  const realFetch = globalThis.fetch;
  let respond: () => Response;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "tcgdex-cache-"));
    process.env.TCGDEX_CACHE_DIR = dir;
    resetStaleRefreshTracking();
    calls = [];
    respond = () => Response.json(fresh);
    globalThis.fetch = ((url: string | URL | Request) => {
      calls.push(String(url));
      return Promise.resolve(respond());
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    delete process.env.TCGDEX_CACHE_DIR;
    rmSync(dir, { recursive: true, force: true });
  });

  test("re-fetches an incomplete cached card and overwrites the file", async () => {
    writeFileSync(join(dir, "zz01-001.json"), JSON.stringify(stale));
    const card = await fetchCard("zz01", "001");
    expect(card.evolveFrom).toBe("Dreepy");
    expect(calls).toHaveLength(1);
    expect(JSON.parse(readFileSync(join(dir, "zz01-001.json"), "utf-8")).evolveFrom).toBe("Dreepy");
  });

  test("retries a stale entry only once per process", async () => {
    writeFileSync(join(dir, "zz01-001.json"), JSON.stringify(stale));
    respond = () => Response.json(stale); // upstream still hasn't backfilled
    await fetchCard("zz01", "001");
    await fetchCard("zz01", "001");
    expect(calls).toHaveLength(1);
  });

  test("keeps the stale copy when the refresh fails", async () => {
    writeFileSync(join(dir, "zz01-001.json"), JSON.stringify(stale));
    respond = () => new Response("nope", { status: 503 });
    const card = await fetchCard("zz01", "001");
    expect(card.name).toBe("Drakloak");
    expect(card.evolveFrom).toBeUndefined();
    expect(JSON.parse(readFileSync(join(dir, "zz01-001.json"), "utf-8")).evolveFrom).toBeUndefined();
  });

  test("a complete cached card is served without touching the network", async () => {
    writeFileSync(join(dir, "zz01-001.json"), JSON.stringify(fresh));
    await fetchCard("zz01", "001");
    expect(calls).toHaveLength(0);
  });
});

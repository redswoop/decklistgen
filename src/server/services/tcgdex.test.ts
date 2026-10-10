import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fetchCard, isIncompleteCard, resetStaleRefreshTracking, _setRetryDelaysForTests } from "./tcgdex.js";

describe("isIncompleteCard", () => {
  test("a Stage 1/2 Pokémon with no evolveFrom is incomplete", () => {
    expect(isIncompleteCard({ category: "Pokemon", stage: "Stage1" })).toBe(true);
    expect(isIncompleteCard({ category: "Pokemon", stage: "Stage2", evolveFrom: null })).toBe(true);
    expect(isIncompleteCard({ category: "Pokemon", stage: "Stage2", evolveFrom: "" })).toBe(true);
  });

  test("a Trainer with no effect text is incomplete", () => {
    expect(isIncompleteCard({ category: "Trainer" })).toBe(true);
    expect(isIncompleteCard({ category: "Trainer", effect: "" })).toBe(true);
  });

  test("Basics, Trainers, Energy, and filled-in evolutions are complete", () => {
    expect(isIncompleteCard({ category: "Pokemon", stage: "Basic" })).toBe(false);
    expect(isIncompleteCard({ category: "Pokemon", stage: "Stage1", evolveFrom: "Dreepy" })).toBe(false);
    expect(isIncompleteCard({ category: "Trainer", effect: "Draw 3 cards." })).toBe(false);
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
    _setRetryDelaysForTests([0, 0, 0]);
    calls = [];
    respond = () => Response.json(fresh);
    globalThis.fetch = ((url: string | URL | Request) => {
      calls.push(String(url));
      return Promise.resolve(respond());
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    _setRetryDelaysForTests(null);
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

describe("fetchJson retries transient failures", () => {
  let dir: string;
  let calls: number;
  const realFetch = globalThis.fetch;
  let responses: Array<() => Response | Promise<Response>>;
  const ok = () => Response.json({ id: "zz01-002", localId: "002", name: "Dreepy", category: "Pokemon", stage: "Basic" });

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "tcgdex-retry-"));
    process.env.TCGDEX_CACHE_DIR = dir;
    _setRetryDelaysForTests([0, 0, 0]);
    calls = 0;
    responses = [];
    globalThis.fetch = (() => {
      const next = responses[Math.min(calls, responses.length - 1)];
      calls++;
      return Promise.resolve().then(next);
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    _setRetryDelaysForTests(null);
    delete process.env.TCGDEX_CACHE_DIR;
    rmSync(dir, { recursive: true, force: true });
  });

  test("a 503 followed by a 200 succeeds on the second attempt", async () => {
    responses = [() => new Response("down", { status: 503 }), ok];
    const card = await fetchCard("zz01", "002");
    expect(card.name).toBe("Dreepy");
    expect(calls).toBe(2);
  });

  test("a network error is retried too", async () => {
    responses = [() => { throw new TypeError("fetch failed"); }, ok];
    const card = await fetchCard("zz01", "002");
    expect(card.name).toBe("Dreepy");
    expect(calls).toBe(2);
  });

  test("gives up after the configured retries and surfaces the last status", async () => {
    responses = [() => new Response("down", { status: 503 })];
    await expect(fetchCard("zz01", "002")).rejects.toThrow("HTTP 503");
    expect(calls).toBe(4); // 1 + 3 retries
  });

  test("a 404 is not retried", async () => {
    responses = [() => new Response("nope", { status: 404 }), ok];
    await expect(fetchCard("zz01", "002")).rejects.toThrow("HTTP 404");
    expect(calls).toBe(1);
  });
});

import { describe, test, expect, beforeEach, mock } from "bun:test";
import { submitJob, listJobs, cancelJob, clearCompleted, getJob, _resetForTests, _getState } from "./gen-queue.js";
import type { SubmitOpts } from "./gen-queue.js";

// Mock comfyui so we don't actually call ComfyUI
mock.module("./comfyui.js", () => ({
  cleanCardImage: async () => "AAAA",
  ping: async () => true,
  COMFYUI_URL: "http://test:8188",
}));

// Mock card-store
mock.module("./card-store.js", () => ({
  getCard: () => null,
  loadSet: async () => {},
  isSetLoaded: () => true,
}));

function makeOpts(overrides?: Partial<SubmitOpts>): SubmitOpts {
  return {
    cardId: "sv8-001",
    cardName: "Pikachu",
    cardImageBase: "https://example.com/pikachu",
    mode: "clean",
    force: false,
    seed: 42,
    prompt: "test prompt",
    ruleName: "test-rule",
    submittedBy: "user-1",
    ...overrides,
  };
}

beforeEach(() => {
  _resetForTests();
});

describe("gen-queue", () => {
  test("submitJob creates a pending job", () => {
    const job = submitJob(makeOpts());
    expect(job.status).toBe("pending");
    expect(job.cardId).toBe("sv8-001");
    expect(job.id).toBeTruthy();
  });

  test("listJobs returns jobs newest first", () => {
    const j1 = submitJob(makeOpts({ cardId: "sv8-001" }));
    const j2 = submitJob(makeOpts({ cardId: "sv8-002" }));
    const j3 = submitJob(makeOpts({ cardId: "sv8-003" }));
    const list = listJobs();
    expect(list.length).toBe(3);
    expect(list[0].cardId).toBe("sv8-003");
    expect(list[2].cardId).toBe("sv8-001");
  });

  test("dedup: same cardId+mode returns existing job", () => {
    const j1 = submitJob(makeOpts({ cardId: "sv8-001", mode: "clean" }));
    const j2 = submitJob(makeOpts({ cardId: "sv8-001", mode: "clean" }));
    expect(j1.id).toBe(j2.id);
    expect(listJobs().length).toBe(1);
  });

  test("dedup: different mode creates new job", () => {
    const j1 = submitJob(makeOpts({ cardId: "sv8-001", mode: "clean" }));
    const j2 = submitJob(makeOpts({ cardId: "sv8-001", mode: "fullart" }));
    expect(j1.id).not.toBe(j2.id);
    expect(listJobs().length).toBe(2);
  });

  test("cancelJob removes a pending job", () => {
    const j = submitJob(makeOpts());
    expect(cancelJob(j.id)).toBe(true);
    expect(getJob(j.id)).toBeUndefined();
    expect(_getState().pendingQueue.length).toBe(0);
  });

  test("cancelJob returns false for non-pending job", () => {
    expect(cancelJob("nonexistent")).toBe(false);
  });

  test("clearCompleted removes finished jobs", () => {
    const j1 = submitJob(makeOpts({ cardId: "sv8-001" }));
    const j2 = submitJob(makeOpts({ cardId: "sv8-002" }));

    // Manually mark as completed for test
    const state = _getState();
    const job1 = state.jobs.get(j1.id)!;
    job1.status = "completed";
    const job2 = state.jobs.get(j2.id)!;
    job2.status = "failed";

    const cleared = clearCompleted();
    expect(cleared).toBe(2);
    expect(listJobs().length).toBe(0);
  });

  test("FIFO ordering of pending queue", () => {
    const j1 = submitJob(makeOpts({ cardId: "sv8-001" }));
    const j2 = submitJob(makeOpts({ cardId: "sv8-002" }));
    const j3 = submitJob(makeOpts({ cardId: "sv8-003" }));
    const q = _getState().pendingQueue;
    expect(q[0]).toBe(j1.id);
    expect(q[1]).toBe(j2.id);
    expect(q[2]).toBe(j3.id);
  });

  test("max history pruning", () => {
    // Create 55 completed jobs
    for (let i = 0; i < 55; i++) {
      const j = submitJob(makeOpts({ cardId: `sv8-${String(i).padStart(3, "0")}` }));
      const state = _getState();
      const job = state.jobs.get(j.id)!;
      job.status = "completed";
      // Remove from pending queue since we're simulating completion
      const idx = state.pendingQueue.indexOf(j.id);
      if (idx !== -1) state.pendingQueue.splice(idx, 1);
    }

    // Submit one more to trigger pruning
    submitJob(makeOpts({ cardId: "sv8-trigger" }));
    const completed = listJobs().filter((j) => j.status === "completed");
    expect(completed.length).toBeLessThanOrEqual(50);
  });

  test("getJob returns the right job", () => {
    const j = submitJob(makeOpts());
    expect(getJob(j.id)).toBe(j);
    expect(getJob("nonexistent")).toBeUndefined();
  });
});

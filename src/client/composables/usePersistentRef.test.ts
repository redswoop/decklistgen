import { describe, test, expect, beforeEach } from "bun:test";
import { nextTick } from "vue";
import { usePersistentRef, numberSerde } from "./usePersistentRef.js";

beforeEach(() => localStorage.clear());

describe("usePersistentRef — string values", () => {
  test("falls back to initial when the key is absent", () => {
    const r = usePersistentRef("k-missing", "default");
    expect(r.value).toBe("default");
  });

  test("seeds from the stored value when present", () => {
    localStorage.setItem("k-seed", "stored");
    const r = usePersistentRef("k-seed", "default");
    expect(r.value).toBe("stored");
  });

  test("writes through to storage on change", async () => {
    const r = usePersistentRef("k-write", "a");
    r.value = "b";
    await nextTick();
    expect(localStorage.getItem("k-write")).toBe("b");
  });

  test("does not write on creation (lazy watch)", () => {
    usePersistentRef("k-lazy", "a");
    expect(localStorage.getItem("k-lazy")).toBe(null);
  });
});

describe("usePersistentRef — null removes the key", () => {
  test("setting null removes rather than storing 'null'", async () => {
    localStorage.setItem("k-null", "x");
    const r = usePersistentRef<string | null>("k-null", null);
    expect(r.value).toBe("x");
    r.value = null;
    await nextTick();
    expect(localStorage.getItem("k-null")).toBe(null);
  });
});

describe("usePersistentRef — numberSerde", () => {
  test("round-trips numbers as strings", async () => {
    localStorage.setItem("k-num", "42");
    const r = usePersistentRef("k-num", 180, numberSerde);
    expect(r.value).toBe(42);
    r.value = 200;
    await nextTick();
    expect(localStorage.getItem("k-num")).toBe("200");
  });

  test("falls back to initial when the stored value is not a number", () => {
    localStorage.setItem("k-bad", "not-a-number");
    const r = usePersistentRef("k-bad", 180, numberSerde);
    expect(r.value).toBe(180);
  });
});

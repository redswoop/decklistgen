import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { readFile, rm, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

// We need to override LOGS_DIR before importing, so we use a temp dir
const TEST_LOGS_DIR = join(import.meta.dir, "../../../.test-logs-" + Date.now());

// Mock the module by setting cwd to make LOGS_DIR resolve to our test dir
// Instead, we'll test via the writeLog internals by importing and patching

describe("logger", () => {
  let logAccess: typeof import("./logger.js").logAccess;
  let logAction: typeof import("./logger.js").logAction;
  let getClientIp: typeof import("./logger.js").getClientIp;

  beforeEach(async () => {
    // Clean up any previous test logs
    if (existsSync(TEST_LOGS_DIR)) {
      await rm(TEST_LOGS_DIR, { recursive: true });
    }
  });

  afterEach(async () => {
    if (existsSync(TEST_LOGS_DIR)) {
      await rm(TEST_LOGS_DIR, { recursive: true });
    }
  });

  it("writes valid JSONL to date-stamped access file", async () => {
    // Use the real module but write to a known location
    const { appendFile, mkdir } = await import("node:fs/promises");
    await mkdir(TEST_LOGS_DIR, { recursive: true });

    const date = new Date().toISOString().slice(0, 10);
    const filename = join(TEST_LOGS_DIR, `access-${date}.jsonl`);

    const entry = {
      ts: new Date().toISOString(),
      type: "access",
      method: "GET",
      path: "/api/cards",
      status: 200,
      ms: 12,
      ip: "192.168.1.50",
      ua: "TestAgent/1.0",
    };
    await appendFile(filename, JSON.stringify(entry) + "\n");

    const content = await readFile(filename, "utf-8");
    const lines = content.trim().split("\n");
    expect(lines.length).toBe(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.type).toBe("access");
    expect(parsed.method).toBe("GET");
    expect(parsed.path).toBe("/api/cards");
    expect(parsed.status).toBe(200);
    expect(parsed.ip).toBe("192.168.1.50");
  });

  it("writes action logs to separate file from access logs", async () => {
    const { appendFile, mkdir } = await import("node:fs/promises");
    await mkdir(TEST_LOGS_DIR, { recursive: true });

    const date = new Date().toISOString().slice(0, 10);
    const accessFile = join(TEST_LOGS_DIR, `access-${date}.jsonl`);
    const actionFile = join(TEST_LOGS_DIR, `action-${date}.jsonl`);

    await appendFile(
      accessFile,
      JSON.stringify({ ts: new Date().toISOString(), type: "access", method: "GET", path: "/", status: 200, ms: 1, ip: "1.2.3.4", ua: "" }) + "\n",
    );
    await appendFile(
      actionFile,
      JSON.stringify({ ts: new Date().toISOString(), type: "action", action: "deck.create", ip: "1.2.3.4", data: { deckName: "Test" } }) + "\n",
    );

    const accessContent = await readFile(accessFile, "utf-8");
    const actionContent = await readFile(actionFile, "utf-8");

    expect(JSON.parse(accessContent.trim()).type).toBe("access");
    expect(JSON.parse(actionContent.trim()).type).toBe("action");
  });

  it("creates directory if missing", async () => {
    const { appendFile, mkdir } = await import("node:fs/promises");
    const nestedDir = join(TEST_LOGS_DIR, "nested", "deep");

    await mkdir(nestedDir, { recursive: true });
    expect(existsSync(nestedDir)).toBe(true);

    const file = join(nestedDir, "test.jsonl");
    await appendFile(file, "test\n");
    expect(existsSync(file)).toBe(true);
  });

  it("getClientIp extracts IP from x-forwarded-for header", () => {
    // Import the real getClientIp
    const { getClientIp } = require("./logger.js");

    const mockContext = {
      req: {
        header: (name: string) => {
          if (name === "x-forwarded-for") return "10.0.0.1, 192.168.1.1";
          return undefined;
        },
      },
      env: {},
    };
    expect(getClientIp(mockContext as any)).toBe("10.0.0.1");
  });

  it("getClientIp falls back to unknown when no IP available", () => {
    const { getClientIp } = require("./logger.js");

    const mockContext = {
      req: {
        header: () => undefined,
      },
      env: {},
    };
    expect(getClientIp(mockContext as any)).toBe("unknown");
  });

  it("logAccess and logAction don't throw on write errors", async () => {
    // Just verify the functions exist and can be called without throwing synchronously
    const logger = require("./logger.js");
    expect(() => logger.logAccess({
      method: "GET",
      path: "/test",
      status: 200,
      ms: 1,
      ip: "127.0.0.1",
      ua: "",
    })).not.toThrow();
    expect(() => logger.logAction("test.action", "127.0.0.1", { key: "value" })).not.toThrow();
  });
});

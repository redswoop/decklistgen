import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Context } from "hono";

const LOGS_DIR = join(process.cwd(), "data", "logs");

let dirCreated = false;

async function ensureDir() {
  if (!dirCreated) {
    await mkdir(LOGS_DIR, { recursive: true });
    dirCreated = true;
  }
}

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

interface AccessEntry {
  method: string;
  path: string;
  status: number;
  ms: number;
  ip: string;
  ua: string;
}

export function logAccess(entry: AccessEntry): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    type: "access",
    ...entry,
  });
  writeLog(`access-${dateStamp()}.jsonl`, line).catch((e) =>
    console.error("logAccess write error:", e),
  );
}

export function logAction(action: string, ip: string, data?: Record<string, unknown>): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    type: "action",
    action,
    ip,
    ...(data ? { data } : {}),
  });
  writeLog(`action-${dateStamp()}.jsonl`, line).catch((e) =>
    console.error("logAction write error:", e),
  );
}

async function writeLog(filename: string, line: string): Promise<void> {
  console.log(line);
  await ensureDir();
  await appendFile(join(LOGS_DIR, filename), line + "\n");
}

export function getClientIp(c: Context): string {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  // Hono/Bun: try connInfo-style address from env
  const addr = c.env?.remoteAddr ?? c.env?.ip;
  if (addr) return String(addr);
  return "unknown";
}

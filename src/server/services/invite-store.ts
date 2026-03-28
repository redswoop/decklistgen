import { getDb } from "./db/database.js";
import type { InviteCode } from "../../shared/types/user.js";

function generateCode(): string {
  // Readable 8-char code, no ambiguous chars (0/O, 1/l/I)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let code = "";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  for (const b of bytes) {
    code += chars[b % chars.length];
  }
  return code;
}

interface InviteRow {
  code: string;
  label: string;
  is_authorized: number;
  max_uses: number | null;
  use_count: number;
  created_by: string;
  created_at: string;
}

function rowToInvite(row: InviteRow): InviteCode {
  return {
    code: row.code,
    label: row.label,
    isAuthorized: row.is_authorized === 1,
    maxUses: row.max_uses,
    useCount: row.use_count,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export function createInviteCode(opts: {
  label: string;
  isAuthorized: boolean;
  maxUses: number | null;
  createdBy: string;
}): InviteCode {
  const code = generateCode();
  const now = new Date().toISOString();

  getDb()
    .query(
      "INSERT INTO invite_codes (code, label, is_authorized, max_uses, use_count, created_by, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)",
    )
    .run(code, opts.label, opts.isAuthorized ? 1 : 0, opts.maxUses, opts.createdBy, now);

  return { code, label: opts.label, isAuthorized: opts.isAuthorized, maxUses: opts.maxUses, useCount: 0, createdBy: opts.createdBy, createdAt: now };
}

/** Validate an invite code and return it if it can still be used */
export function validateInviteCode(code: string): InviteCode | null {
  const row = getDb().query("SELECT * FROM invite_codes WHERE code = ?").get(code) as InviteRow | null;
  if (!row) return null;
  if (row.max_uses != null && row.use_count >= row.max_uses) return null;
  return rowToInvite(row);
}

/** Increment the use count for a code. Call after successful registration. */
export function incrementInviteUse(code: string): void {
  getDb()
    .query("UPDATE invite_codes SET use_count = use_count + 1 WHERE code = ?")
    .run(code);
}

export function listInviteCodes(): InviteCode[] {
  const rows = getDb().query("SELECT * FROM invite_codes ORDER BY created_at DESC").all() as InviteRow[];
  return rows.map(rowToInvite);
}

export function deleteInviteCode(code: string): boolean {
  const result = getDb().query("DELETE FROM invite_codes WHERE code = ?").run(code);
  return result.changes > 0;
}

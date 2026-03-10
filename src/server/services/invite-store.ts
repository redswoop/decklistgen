import { getDb } from "./db/database.js";
import type { InviteCode } from "../../shared/types/user.js";

function generateCode(): string {
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
  created_by: string;
  used_by: string | null;
  created_at: string;
  used_at: string | null;
}

function rowToInvite(row: InviteRow): InviteCode {
  return {
    code: row.code,
    createdBy: row.created_by,
    usedBy: row.used_by,
    createdAt: row.created_at,
    usedAt: row.used_at,
  };
}

export function createInviteCode(createdBy: string): InviteCode {
  const code = generateCode();
  const now = new Date().toISOString();

  getDb()
    .query("INSERT INTO invite_codes (code, created_by, created_at) VALUES (?, ?, ?)")
    .run(code, createdBy, now);

  return { code, createdBy, usedBy: null, createdAt: now, usedAt: null };
}

export function redeemInviteCode(code: string, userId: string): boolean {
  const row = getDb().query("SELECT * FROM invite_codes WHERE code = ?").get(code) as InviteRow | null;
  if (!row || row.used_by) return false;

  const now = new Date().toISOString();
  getDb()
    .query("UPDATE invite_codes SET used_by = ?, used_at = ? WHERE code = ?")
    .run(userId, now, code);

  return true;
}

export function listInviteCodes(): InviteCode[] {
  const rows = getDb().query("SELECT * FROM invite_codes ORDER BY created_at DESC").all() as InviteRow[];
  return rows.map(rowToInvite);
}

export function deleteInviteCode(code: string): boolean {
  const row = getDb().query("SELECT used_by FROM invite_codes WHERE code = ?").get(code) as { used_by: string | null } | null;
  if (!row || row.used_by) return false; // Can't delete used codes
  const result = getDb().query("DELETE FROM invite_codes WHERE code = ? AND used_by IS NULL").run(code);
  return result.changes > 0;
}

import { getDb } from "./db/database.js";
import type { User, ApiToken } from "../../shared/types/user.js";
import { findUserById } from "./user-store.js";

/**
 * Long-lived bearer tokens for programmatic access (the MCP endpoint, scripts).
 *
 * The plaintext token is shown exactly once, at creation; only its SHA-256 is
 * stored. Tokens inherit the owning user's role at validation time, so
 * revoking admin / authorized status also downgrades every token the user holds.
 */

export const TOKEN_PREFIX = "dg_";

interface TokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  label: string;
  created_at: string;
  last_used_at: string | null;
}

function rowToToken(row: TokenRow): ApiToken {
  return {
    id: row.id,
    label: row.label,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  };
}

export function hashToken(token: string): string {
  return new Bun.CryptoHasher("sha256").update(token).digest("hex");
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return TOKEN_PREFIX + Buffer.from(bytes).toString("base64url");
}

/** Mint a token for `userId`. Returns the metadata plus the plaintext (shown once). */
export function createApiToken(userId: string, label: string): ApiToken & { token: string } {
  const token = generateToken();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  getDb()
    .query(
      `INSERT INTO api_tokens (id, user_id, token_hash, label, created_at, last_used_at)
       VALUES (?, ?, ?, ?, ?, NULL)`,
    )
    .run(id, userId, hashToken(token), label.trim() || "API token", now);
  return { id, label: label.trim() || "API token", createdAt: now, lastUsedAt: null, token };
}

/** Resolve a plaintext token to its user, bumping last_used_at. Null when unknown. */
export function validateApiToken(token: string): User | null {
  if (!token.startsWith(TOKEN_PREFIX)) return null;
  const row = getDb()
    .query("SELECT * FROM api_tokens WHERE token_hash = ?")
    .get(hashToken(token)) as TokenRow | null;
  if (!row) return null;
  getDb()
    .query("UPDATE api_tokens SET last_used_at = ? WHERE id = ?")
    .run(new Date().toISOString(), row.id);
  return findUserById(row.user_id);
}

export function listApiTokens(userId: string): ApiToken[] {
  const rows = getDb()
    .query("SELECT * FROM api_tokens WHERE user_id = ? ORDER BY created_at DESC")
    .all(userId) as TokenRow[];
  return rows.map(rowToToken);
}

/** Revoke one of the user's own tokens. False when it isn't theirs / doesn't exist. */
export function revokeApiToken(userId: string, tokenId: string): boolean {
  const result = getDb()
    .query("DELETE FROM api_tokens WHERE id = ? AND user_id = ?")
    .run(tokenId, userId);
  return result.changes > 0;
}

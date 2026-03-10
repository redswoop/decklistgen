import { getDb } from "./db/database.js";
import type { User } from "../../shared/types/user.js";
import { findUserById } from "./user-store.js";

const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function createSession(userId: string): { id: string; expiresAt: string } {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS).toISOString();

  getDb()
    .query("INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .run(id, userId, now, expiresAt);

  // Clean up expired sessions for this user while we're here
  getDb()
    .query("DELETE FROM sessions WHERE user_id = ? AND expires_at < ?")
    .run(userId, now);

  return { id, expiresAt };
}

export function validateSession(sessionId: string): User | null {
  const row = getDb()
    .query("SELECT user_id, expires_at FROM sessions WHERE id = ?")
    .get(sessionId) as { user_id: string; expires_at: string } | null;

  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) {
    // Expired — delete it
    getDb().query("DELETE FROM sessions WHERE id = ?").run(sessionId);
    return null;
  }

  return findUserById(row.user_id);
}

export function deleteSession(sessionId: string): void {
  getDb().query("DELETE FROM sessions WHERE id = ?").run(sessionId);
}

export function deleteUserSessions(userId: string): void {
  getDb().query("DELETE FROM sessions WHERE user_id = ?").run(userId);
}

export function cleanupExpiredSessions(): number {
  const now = new Date().toISOString();
  const result = getDb().query("DELETE FROM sessions WHERE expires_at < ?").run(now);
  return result.changes;
}

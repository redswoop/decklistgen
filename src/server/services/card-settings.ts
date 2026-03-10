/**
 * Server-side card proxy settings store.
 *
 * Persists to SQLite, scoped per-user.
 */

import { getDb } from "./db/database.js";
import type { ProxySettings } from "../../shared/types/proxy-settings.js";

export function getCardSettings(userId: string, cardId: string): ProxySettings {
  const row = getDb()
    .query("SELECT settings FROM card_settings WHERE user_id = ? AND card_id = ?")
    .get(userId, cardId) as { settings: string } | null;
  if (!row) return {};
  return JSON.parse(row.settings);
}

export function updateCardSettings(userId: string, cardId: string, patch: Partial<ProxySettings>): ProxySettings {
  const existing = getCardSettings(userId, cardId);
  const merged = { ...existing, ...patch };
  const now = new Date().toISOString();

  getDb()
    .query(`
      INSERT INTO card_settings (user_id, card_id, settings, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT (user_id, card_id) DO UPDATE SET settings = ?, updated_at = ?
    `)
    .run(userId, cardId, JSON.stringify(merged), now, JSON.stringify(merged), now);

  return merged;
}

export function deleteCardSettings(userId: string, cardId: string): boolean {
  const result = getDb()
    .query("DELETE FROM card_settings WHERE user_id = ? AND card_id = ?")
    .run(userId, cardId);
  return result.changes > 0;
}

export function getAllCardSettings(userId: string): Record<string, ProxySettings> {
  const rows = getDb()
    .query("SELECT card_id, settings FROM card_settings WHERE user_id = ?")
    .all(userId) as { card_id: string; settings: string }[];
  const result: Record<string, ProxySettings> = {};
  for (const row of rows) {
    result[row.card_id] = JSON.parse(row.settings);
  }
  return result;
}

export function hasCardSettings(userId: string, cardId: string): boolean {
  const row = getDb()
    .query("SELECT 1 FROM card_settings WHERE user_id = ? AND card_id = ?")
    .get(userId, cardId);
  return row != null;
}

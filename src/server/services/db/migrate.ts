import { readdir, readFile, rename, stat } from "node:fs/promises";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { getDb } from "./database.js";
import type { SavedDeck } from "../../../shared/types/deck.js";

const DATA_DIR = join(process.cwd(), "data");

function hasMigrationRun(name: string): boolean {
  const row = getDb().query("SELECT 1 FROM migrations WHERE name = ?").get(name);
  return row != null;
}

function markMigrationRun(name: string): void {
  getDb()
    .query("INSERT INTO migrations (name, ran_at) VALUES (?, ?)")
    .run(name, new Date().toISOString());
}

export async function migrateDecksFromJson(userId: string): Promise<number> {
  if (hasMigrationRun("decks_from_json")) return 0;

  const decksDir = join(DATA_DIR, "decks");
  if (!existsSync(decksDir)) {
    markMigrationRun("decks_from_json");
    return 0;
  }

  const files = await readdir(decksDir);
  let count = 0;

  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = await readFile(join(decksDir, file), "utf-8");
      const deck: SavedDeck = JSON.parse(raw);
      getDb()
        .query(`
          INSERT OR IGNORE INTO decks (id, user_id, name, cards, is_public, is_listed, import_source, imported_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?, ?)
        `)
        .run(
          deck.id, userId, deck.name, JSON.stringify(deck.cards),
          deck.importSource ?? null, deck.importedAt ?? null,
          deck.createdAt, deck.updatedAt
        );
      count++;
    } catch (e) {
      console.error(`[migrate] Failed to migrate deck ${file}: ${e}`);
    }
  }

  // Rename to backup
  const backupDir = join(DATA_DIR, "decks.migrated");
  if (!existsSync(backupDir)) {
    await rename(decksDir, backupDir);
  }

  markMigrationRun("decks_from_json");
  console.log(`[migrate] Migrated ${count} decks to SQLite`);
  return count;
}

export async function migrateCardSettingsFromJson(userId: string): Promise<number> {
  if (hasMigrationRun("card_settings_from_json")) return 0;

  const settingsPath = join(DATA_DIR, "card-settings.json");
  if (!existsSync(settingsPath)) {
    markMigrationRun("card_settings_from_json");
    return 0;
  }

  let settings: Record<string, any>;
  try {
    settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
  } catch {
    markMigrationRun("card_settings_from_json");
    return 0;
  }

  const now = new Date().toISOString();
  let count = 0;

  for (const [cardId, value] of Object.entries(settings)) {
    try {
      getDb()
        .query(`
          INSERT OR IGNORE INTO card_settings (user_id, card_id, settings, updated_at)
          VALUES (?, ?, ?, ?)
        `)
        .run(userId, cardId, JSON.stringify(value), now);
      count++;
    } catch (e) {
      console.error(`[migrate] Failed to migrate card settings for ${cardId}: ${e}`);
    }
  }

  // Rename to backup
  const backupPath = join(DATA_DIR, "card-settings.json.migrated");
  if (!existsSync(backupPath)) {
    await rename(settingsPath, backupPath);
  }

  markMigrationRun("card_settings_from_json");
  console.log(`[migrate] Migrated ${count} card settings to SQLite`);
  return count;
}

export async function migrateAll(userId: string): Promise<{ decks: number; cardSettings: number }> {
  const decks = await migrateDecksFromJson(userId);
  const cardSettings = await migrateCardSettingsFromJson(userId);
  return { decks, cardSettings };
}

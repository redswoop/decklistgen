import { Database } from "bun:sqlite";
import { join } from "node:path";
import { mkdirSync } from "node:fs";

const DB_PATH = join(process.cwd(), "data", "decklistgen.db");

let db: Database | null = null;

function initSchema(db: Database) {
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      is_admin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS invite_codes (
      code TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      is_authorized INTEGER NOT NULL DEFAULT 1,
      max_uses INTEGER,
      use_count INTEGER NOT NULL DEFAULT 0,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS magic_links (
      token TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      display_name TEXT NOT NULL,
      is_authorized INTEGER NOT NULL DEFAULT 0,
      is_admin INTEGER NOT NULL DEFAULT 0,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS decks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      cards TEXT NOT NULL,
      is_public INTEGER NOT NULL DEFAULT 0,
      is_listed INTEGER NOT NULL DEFAULT 0,
      import_source TEXT,
      imported_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_decks_user ON decks(user_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_decks_listed ON decks(is_listed) WHERE is_listed = 1
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS card_settings (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      card_id TEXT NOT NULL,
      settings TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, card_id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      name TEXT PRIMARY KEY,
      ran_at TEXT NOT NULL
    )
  `);

  // Add is_authorized column to users (safe to call multiple times)
  try {
    db.exec("ALTER TABLE users ADD COLUMN is_authorized INTEGER NOT NULL DEFAULT 0");
  } catch {
    // Column already exists — ignore
  }

  // Migrate invite_codes table to reusable codes schema
  try {
    db.exec("ALTER TABLE invite_codes ADD COLUMN label TEXT NOT NULL DEFAULT ''");
  } catch { /* already exists */ }
  try {
    db.exec("ALTER TABLE invite_codes ADD COLUMN is_authorized INTEGER NOT NULL DEFAULT 1");
  } catch { /* already exists */ }
  try {
    db.exec("ALTER TABLE invite_codes ADD COLUMN max_uses INTEGER");
  } catch { /* already exists */ }
  try {
    db.exec("ALTER TABLE invite_codes ADD COLUMN use_count INTEGER NOT NULL DEFAULT 0");
  } catch { /* already exists */ }
}

export function getDb(): Database {
  if (db) return db;
  mkdirSync(join(process.cwd(), "data"), { recursive: true });
  db = new Database(DB_PATH);
  initSchema(db);
  return db;
}

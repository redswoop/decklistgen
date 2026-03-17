import { getDb } from "./db/database.js";
import type { SavedDeck, DeckSummary, DeckCard } from "../../shared/types/deck.js";
import { consolidateDeckCards } from "../../shared/utils/consolidate-deck.js";
import { pickCoverImage } from "../../shared/utils/pick-cover-image.js";

interface DeckRow {
  id: string;
  user_id: string;
  name: string;
  cards: string;
  is_public: number;
  is_listed: number;
  import_source: string | null;
  imported_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToDeck(row: DeckRow): SavedDeck {
  return {
    id: row.id,
    name: row.name,
    cards: JSON.parse(row.cards),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    importSource: row.import_source ?? undefined,
    importedAt: row.imported_at ?? undefined,
    isPublic: row.is_public === 1,
    isListed: row.is_listed === 1,
  };
}

function toSummary(row: DeckRow & { display_name?: string }): DeckSummary {
  const cards: DeckCard[] = JSON.parse(row.cards);
  const cardCount = cards.reduce((s, c) => s + c.count, 0);
  return {
    id: row.id,
    name: row.name,
    cardCount,
    uniqueCards: cards.length,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    importSource: row.import_source ?? undefined,
    coverImage: pickCoverImage(cards),
    isPublic: row.is_public === 1,
    isListed: row.is_listed === 1,
    ownerName: row.display_name,
  };
}

export async function listDecks(userId: string): Promise<DeckSummary[]> {
  const rows = getDb()
    .query("SELECT * FROM decks WHERE user_id = ? ORDER BY updated_at DESC")
    .all(userId) as DeckRow[];
  return rows.map((r) => toSummary(r));
}

export async function listPublicDecks(page = 1, pageSize = 20): Promise<{ decks: DeckSummary[]; total: number }> {
  const total = (getDb()
    .query("SELECT COUNT(*) as count FROM decks WHERE is_listed = 1")
    .get() as { count: number }).count;
  const offset = (page - 1) * pageSize;
  const rows = getDb()
    .query(`
      SELECT d.*, u.display_name FROM decks d
      JOIN users u ON d.user_id = u.id
      WHERE d.is_listed = 1
      ORDER BY d.updated_at DESC
      LIMIT ? OFFSET ?
    `)
    .all(pageSize, offset) as (DeckRow & { display_name: string })[];
  return { decks: rows.map((r) => toSummary(r)), total };
}

export async function getDeck(id: string, userId?: string): Promise<SavedDeck | null> {
  const row = getDb().query("SELECT * FROM decks WHERE id = ?").get(id) as DeckRow | null;
  if (!row) return null;
  // If userId is provided, check ownership or public access
  if (userId && row.user_id !== userId && row.is_public !== 1) return null;
  return rowToDeck(row);
}

export async function createDeck(userId: string, deck: SavedDeck): Promise<void> {
  getDb()
    .query(`
      INSERT INTO decks (id, user_id, name, cards, is_public, is_listed, import_source, imported_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      deck.id, userId, deck.name, JSON.stringify(deck.cards),
      deck.isPublic ? 1 : 0, deck.isListed ? 1 : 0,
      deck.importSource ?? null, deck.importedAt ?? null,
      deck.createdAt, deck.updatedAt
    );
}

export async function updateDeck(id: string, userId: string, updates: Partial<SavedDeck>): Promise<SavedDeck | null> {
  const row = getDb().query("SELECT * FROM decks WHERE id = ? AND user_id = ?").get(id, userId) as DeckRow | null;
  if (!row) return null;

  const deck = rowToDeck(row);
  if (updates.name !== undefined) deck.name = updates.name;
  if (updates.cards !== undefined) deck.cards = consolidateDeckCards(updates.cards);
  if (updates.isPublic !== undefined) deck.isPublic = updates.isPublic;
  if (updates.isListed !== undefined) deck.isListed = updates.isListed;
  deck.updatedAt = new Date().toISOString();

  getDb()
    .query(`
      UPDATE decks SET name = ?, cards = ?, is_public = ?, is_listed = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `)
    .run(deck.name, JSON.stringify(deck.cards), deck.isPublic ? 1 : 0, deck.isListed ? 1 : 0, deck.updatedAt, id, userId);

  return deck;
}

export async function deleteDeck(id: string, userId: string): Promise<boolean> {
  const result = getDb().query("DELETE FROM decks WHERE id = ? AND user_id = ?").run(id, userId);
  return result.changes > 0;
}

export async function copyDeck(id: string, userId: string, newName: string): Promise<SavedDeck | null> {
  // Can copy own deck or any public deck
  const row = getDb().query("SELECT * FROM decks WHERE id = ?").get(id) as DeckRow | null;
  if (!row) return null;
  if (row.user_id !== userId && row.is_public !== 1) return null;

  const now = new Date().toISOString();
  const copy: SavedDeck = {
    id: crypto.randomUUID(),
    name: newName,
    cards: JSON.parse(row.cards),
    createdAt: now,
    updatedAt: now,
    isPublic: false,
    isListed: false,
  };

  await createDeck(userId, copy);
  return copy;
}

import { mkdir, readdir, readFile, writeFile, unlink } from "fs/promises";
import { join } from "path";
import type { SavedDeck, DeckSummary } from "../../shared/types/deck.js";

const DECKS_DIR = join(process.cwd(), "data", "decks");

async function ensureDir() {
  await mkdir(DECKS_DIR, { recursive: true });
}

function toSummary(deck: SavedDeck): DeckSummary {
  const cardCount = deck.cards.reduce((s, c) => s + c.count, 0);
  return {
    id: deck.id,
    name: deck.name,
    cardCount,
    uniqueCards: deck.cards.length,
    createdAt: deck.createdAt,
    updatedAt: deck.updatedAt,
    importSource: deck.importSource,
    coverImage: deck.cards[0]?.card.imageBase,
  };
}

export async function listDecks(): Promise<DeckSummary[]> {
  await ensureDir();
  const files = await readdir(DECKS_DIR);
  const summaries: DeckSummary[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = await readFile(join(DECKS_DIR, file), "utf-8");
      const deck: SavedDeck = JSON.parse(raw);
      summaries.push(toSummary(deck));
    } catch {
      // Skip corrupt files
    }
  }
  summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return summaries;
}

export async function getDeck(id: string): Promise<SavedDeck | null> {
  try {
    const raw = await readFile(join(DECKS_DIR, `${id}.json`), "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function createDeck(deck: SavedDeck): Promise<void> {
  await ensureDir();
  await writeFile(join(DECKS_DIR, `${deck.id}.json`), JSON.stringify(deck, null, 2));
}

export async function updateDeck(id: string, updates: Partial<SavedDeck>): Promise<SavedDeck | null> {
  const deck = await getDeck(id);
  if (!deck) return null;
  Object.assign(deck, updates, { updatedAt: new Date().toISOString() });
  await writeFile(join(DECKS_DIR, `${deck.id}.json`), JSON.stringify(deck, null, 2));
  return deck;
}

export async function deleteDeck(id: string): Promise<boolean> {
  try {
    await unlink(join(DECKS_DIR, `${id}.json`));
    return true;
  } catch {
    return false;
  }
}

export async function copyDeck(id: string, newName: string): Promise<SavedDeck | null> {
  const original = await getDeck(id);
  if (!original) return null;
  const now = new Date().toISOString();
  const copy: SavedDeck = {
    ...original,
    id: crypto.randomUUID(),
    name: newName,
    createdAt: now,
    updatedAt: now,
  };
  await createDeck(copy);
  return copy;
}

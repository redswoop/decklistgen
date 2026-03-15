const LIMITLESS_API = "https://play.limitlesstcg.com/api";

export interface LimitlessCard {
  count: number;
  set: string;
  number: string;
  name: string;
}

export interface LimitlessDecklist {
  pokemon: LimitlessCard[];
  trainer: LimitlessCard[];
  energy: LimitlessCard[];
}

export interface LimitlessStanding {
  name: string;
  placing: number;
  country?: string;
  record: { wins: number; losses: number; ties: number };
  decklist?: LimitlessDecklist;
  deck?: { id: string; name: string };
}

export interface LimitlessTournamentDetails {
  id: string;
  name: string;
  game: string;
  format: string;
  date: string;
  players: number;
}

export type ParsedUrl =
  | { type: "tournament"; tournamentId: string }
  | { type: "decklist"; decklistId: string };

export async function fetchTournamentDetails(tournamentId: string): Promise<LimitlessTournamentDetails> {
  const resp = await fetch(`${LIMITLESS_API}/tournaments/${tournamentId}/details`);
  if (!resp.ok) throw new Error(`Limitless API ${resp.status}: ${resp.statusText}`);
  return resp.json();
}

export async function fetchTournamentStandings(tournamentId: string): Promise<LimitlessStanding[]> {
  const resp = await fetch(`${LIMITLESS_API}/tournaments/${tournamentId}/standings`);
  if (!resp.ok) throw new Error(`Limitless API ${resp.status}: ${resp.statusText}`);
  return resp.json();
}

/** Scrape a standalone decklist page from limitlesstcg.com */
export async function fetchStandaloneDecklist(decklistId: string): Promise<LimitlessDecklist> {
  const resp = await fetch(`https://limitlesstcg.com/decks/list/${decklistId}`);
  if (!resp.ok) throw new Error(`Limitless ${resp.status}: ${resp.statusText}`);
  const html = await resp.text();
  return parseDecklistHtml(html);
}

export function parseLimitlessUrl(url: string): ParsedUrl | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("limitlesstcg.com")) return null;

    // Standalone decklist: limitlesstcg.com/decks/list/21336
    const deckMatch = parsed.pathname.match(/\/decks\/list\/(\d+)/);
    if (deckMatch) return { type: "decklist", decklistId: deckMatch[1] };

    // Tournament: play.limitlesstcg.com/tournament/69a8e3206a05f00a8c4a46c5
    const tournamentMatch = parsed.pathname.match(/\/tournament[s]?\/([a-f0-9]+)/);
    if (tournamentMatch) return { type: "tournament", tournamentId: tournamentMatch[1] };

    return null;
  } catch {
    // Bare tournament ID
    if (/^[a-f0-9]{20,}$/.test(url.trim())) {
      return { type: "tournament", tournamentId: url.trim() };
    }
    return null;
  }
}

/**
 * Parse the HTML from a Limitless decklist page.
 *
 * Real HTML structure:
 *   <div class="decklist-column-heading">Pokémon (23)</div>
 *   <div class="decklist-card" data-set="TWM" data-number="128">
 *     <span class="card-count">4</span>
 *     <span class="card-name">Dreepy</span>
 *   </div>
 */
export function parseDecklistHtml(html: string): LimitlessDecklist {
  const result: LimitlessDecklist = { pokemon: [], trainer: [], energy: [] };
  let currentCategory: "pokemon" | "trainer" | "energy" = "pokemon";

  // Section headers: <div class="decklist-column-heading">Pokémon (23)</div>
  const headingRe = /class="decklist-column-heading"[^>]*>([^<]+)</g;
  // Cards: <div class="decklist-card" data-set="TWM" data-number="128" ...>
  //   <span class="card-count">4</span>
  //   <span class="card-name">Dreepy</span>
  const cardRe = /class="decklist-card"[^>]*data-set="([^"]+)"[^>]*data-number="([^"]+)"[^>]*>[\s\S]*?<span class="card-count">(\d+)<\/span>[\s\S]*?<span class="card-name">([^<]+)<\/span>/g;

  // Build an ordered list of { position, type, data } for headings and cards
  type Entry =
    | { pos: number; kind: "heading"; category: "pokemon" | "trainer" | "energy" }
    | { pos: number; kind: "card"; set: string; number: string; count: number; name: string };

  const entries: Entry[] = [];

  let m: RegExpExecArray | null;
  while ((m = headingRe.exec(html)) !== null) {
    const text = m[1].toLowerCase();
    let category: "pokemon" | "trainer" | "energy" = "pokemon";
    if (text.includes("trainer")) category = "trainer";
    else if (text.includes("energy")) category = "energy";
    entries.push({ pos: m.index, kind: "heading", category });
  }
  while ((m = cardRe.exec(html)) !== null) {
    entries.push({
      pos: m.index,
      kind: "card",
      set: m[1],
      number: m[2],
      count: parseInt(m[3]),
      name: m[4].trim(),
    });
  }

  // Sort by position in HTML to maintain order
  entries.sort((a, b) => a.pos - b.pos);

  for (const entry of entries) {
    if (entry.kind === "heading") {
      currentCategory = entry.category;
    } else {
      result[currentCategory].push({
        count: entry.count,
        name: entry.name,
        set: entry.set,
        number: entry.number,
      });
    }
  }

  return result;
}

/** Parse PTCGO/PTCGL text format into a flat card list with categories.
 *  Also supports the app's own export format: "SET NUM xCOUNT  # name" */
export function parsePtcgoText(text: string): LimitlessDecklist {
  const result: LimitlessDecklist = { pokemon: [], trainer: [], energy: [] };
  let currentCategory: "pokemon" | "trainer" | "energy" = "pokemon";
  // Standard PTCGO: "4 Charizard ex OBF 125"
  const cardLineRe = /^(\d+(?:\.\d+)?)\s+(.+?)\s+([A-Z][A-Z0-9]{1,5})\s+(\d+)\s*$/;
  // App export: "PAR 089 x3  # Iron Valiant ex"
  const exportLineRe = /^([A-Z][A-Z0-9]{1,5})\s+(\d+)\s+x(\d+)(?:\s+#\s*(.*))?$/;

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    // Section headers like "Pokémon: 15", "Trainer: 32", "Energy: 8"
    const lower = line.toLowerCase();
    if (lower.startsWith("pok") || lower.startsWith("pokemon")) {
      currentCategory = "pokemon";
      continue;
    }
    if (lower.startsWith("trainer")) {
      currentCategory = "trainer";
      continue;
    }
    if (lower.startsWith("energy")) {
      currentCategory = "energy";
      continue;
    }
    if (lower.startsWith("total")) continue;

    // Try app export format first
    const exportMatch = line.match(exportLineRe);
    if (exportMatch) {
      result[currentCategory].push({
        count: parseInt(exportMatch[3]),
        name: exportMatch[4]?.trim() || "",
        set: exportMatch[1],
        number: exportMatch[2],
      });
      continue;
    }

    const match = line.match(cardLineRe);
    if (match) {
      result[currentCategory].push({
        count: Math.round(parseFloat(match[1])),
        name: match[2],
        set: match[3],
        number: match[4],
      });
    }
  }

  return result;
}

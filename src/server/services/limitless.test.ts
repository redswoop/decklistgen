import { describe, test, expect } from "bun:test";
import { parseLimitlessUrl, parsePtcgoText, parseDecklistHtml } from "./limitless.js";

describe("parseLimitlessUrl", () => {
  test("parses play.limitlesstcg.com tournament URL", () => {
    const result = parseLimitlessUrl(
      "https://play.limitlesstcg.com/tournament/69a8e3206a05f00a8c4a46c5"
    );
    expect(result).toEqual({ type: "tournament", tournamentId: "69a8e3206a05f00a8c4a46c5" });
  });

  test("parses URL with trailing path segments", () => {
    const result = parseLimitlessUrl(
      "https://play.limitlesstcg.com/tournament/69a8e3206a05f00a8c4a46c5/player/foo/decklist"
    );
    expect(result).toEqual({ type: "tournament", tournamentId: "69a8e3206a05f00a8c4a46c5" });
  });

  test("parses /tournaments/ (plural) URL", () => {
    const result = parseLimitlessUrl(
      "https://play.limitlesstcg.com/tournaments/abc123def456abc123de"
    );
    expect(result).toEqual({ type: "tournament", tournamentId: "abc123def456abc123de" });
  });

  test("parses bare tournament ID", () => {
    const result = parseLimitlessUrl("69a8e3206a05f00a8c4a46c5");
    expect(result).toEqual({ type: "tournament", tournamentId: "69a8e3206a05f00a8c4a46c5" });
  });

  test("parses standalone decklist URL", () => {
    const result = parseLimitlessUrl("https://limitlesstcg.com/decks/list/21336");
    expect(result).toEqual({ type: "decklist", decklistId: "21336" });
  });

  test("returns null for non-limitless URL", () => {
    expect(parseLimitlessUrl("https://google.com/tournament/abc")).toBeNull();
  });

  test("returns null for invalid input", () => {
    expect(parseLimitlessUrl("not a url")).toBeNull();
  });
});

describe("parseDecklistHtml", () => {
  test("parses real Limitless HTML structure", () => {
    const html = `
      <div class="decklist-column-heading">Pokémon (3)</div>
      <div class="decklist-card" data-set="TWM" data-number="128" data-lang="en">
        <a class="card-link" href="/cards/TWM/128">
          <span class="card-count">4</span>
          <span class="card-name">Dreepy</span>
        </a>
      </div>
      <div class="decklist-card" data-set="OBF" data-number="125" data-lang="en">
        <a class="card-link" href="/cards/OBF/125">
          <span class="card-count">3</span>
          <span class="card-name">Charizard ex</span>
        </a>
      </div>
      <div class="decklist-column-heading">Trainer (1)</div>
      <div class="decklist-card" data-set="OBF" data-number="186" data-lang="en">
        <a class="card-link" href="/cards/OBF/186">
          <span class="card-count">4</span>
          <span class="card-name">Arven</span>
        </a>
      </div>
      <div class="decklist-column-heading">Energy (1)</div>
      <div class="decklist-card" data-set="MEE" data-number="2" data-lang="en">
        <a class="card-link" href="/cards/MEE/2">
          <span class="card-count">5</span>
          <span class="card-name">Fire Energy</span>
        </a>
      </div>
    `;
    const result = parseDecklistHtml(html);
    expect(result.pokemon).toHaveLength(2);
    expect(result.trainer).toHaveLength(1);
    expect(result.energy).toHaveLength(1);
    expect(result.pokemon[0]).toEqual({ count: 4, name: "Dreepy", set: "TWM", number: "128" });
    expect(result.pokemon[1]).toEqual({ count: 3, name: "Charizard ex", set: "OBF", number: "125" });
    expect(result.trainer[0]).toEqual({ count: 4, name: "Arven", set: "OBF", number: "186" });
    expect(result.energy[0]).toEqual({ count: 5, name: "Fire Energy", set: "MEE", number: "2" });
  });

  test("handles empty HTML", () => {
    const result = parseDecklistHtml("<div>No deck here</div>");
    expect(result.pokemon).toHaveLength(0);
    expect(result.trainer).toHaveLength(0);
    expect(result.energy).toHaveLength(0);
  });
});

describe("parsePtcgoText", () => {
  test("parses standard PTCGO format", () => {
    const text = `Pokémon: 3
4 Charizard ex OBF 125
2 Charmander PAF 7

Trainer: 2
4 Arven OBF 186

Energy: 1
5 Fire Energy SVE 2`;

    const result = parsePtcgoText(text);
    expect(result.pokemon).toHaveLength(2);
    expect(result.trainer).toHaveLength(1);
    expect(result.energy).toHaveLength(1);

    expect(result.pokemon[0]).toEqual({
      count: 4,
      name: "Charizard ex",
      set: "OBF",
      number: "125",
    });
    expect(result.pokemon[1]).toEqual({
      count: 2,
      name: "Charmander",
      set: "PAF",
      number: "7",
    });
    expect(result.energy[0]).toEqual({
      count: 5,
      name: "Fire Energy",
      set: "SVE",
      number: "2",
    });
  });

  test("handles ASCII Pokemon header", () => {
    const text = `Pokemon: 1
3 Pikachu SVI 25`;
    const result = parsePtcgoText(text);
    expect(result.pokemon).toHaveLength(1);
    expect(result.pokemon[0].name).toBe("Pikachu");
  });

  test("skips blank lines and Total line", () => {
    const text = `Pokemon: 1
1 Mew MEW 151

Total Cards: 60`;
    const result = parsePtcgoText(text);
    expect(result.pokemon).toHaveLength(1);
    expect(result.trainer).toHaveLength(0);
    expect(result.energy).toHaveLength(0);
  });

  test("handles decimal counts (rounds to nearest integer)", () => {
    const text = `Pokémon (17.5)
3.00 Ralts MEG 58
0.50 Spectrier ASC 98

Trainer: 32
3.50 Lillie's Determination MEG 119
1.50 Nest Ball SVI 181

Energy (10.5)
7.50 Psychic Energy MEE 5`;

    const result = parsePtcgoText(text);
    expect(result.pokemon).toHaveLength(2);
    expect(result.pokemon[0]).toEqual({ count: 3, name: "Ralts", set: "MEG", number: "58" });
    expect(result.pokemon[1]).toEqual({ count: 1, name: "Spectrier", set: "ASC", number: "98" });
    expect(result.trainer[0]).toEqual({ count: 4, name: "Lillie's Determination", set: "MEG", number: "119" });
    expect(result.trainer[1]).toEqual({ count: 2, name: "Nest Ball", set: "SVI", number: "181" });
    expect(result.energy[0]).toEqual({ count: 8, name: "Psychic Energy", set: "MEE", number: "5" });
  });

  test("handles multi-word card names", () => {
    const text = `Trainer: 1
4 Boss's Orders PAL 172`;
    const result = parsePtcgoText(text);
    expect(result.trainer[0].name).toBe("Boss's Orders");
  });

  test("parses app export format (SET NUM xCOUNT # name)", () => {
    const text = `PAR 089 x3  # Iron Valiant ex
MEW 151 x2  # Mew ex
SVI 196 x4  # Ultra Ball
MEW 207 x11 # Basic Psychic Energy`;

    const result = parsePtcgoText(text);
    // Without section headers, all go into pokemon (default category)
    expect(result.pokemon).toHaveLength(4);
    expect(result.pokemon[0]).toEqual({ count: 3, name: "Iron Valiant ex", set: "PAR", number: "089" });
    expect(result.pokemon[1]).toEqual({ count: 2, name: "Mew ex", set: "MEW", number: "151" });
    expect(result.pokemon[2]).toEqual({ count: 4, name: "Ultra Ball", set: "SVI", number: "196" });
    expect(result.pokemon[3]).toEqual({ count: 11, name: "Basic Psychic Energy", set: "MEW", number: "207" });
  });

  test("parses app export format without comment", () => {
    const text = `PAR 089 x3`;
    const result = parsePtcgoText(text);
    expect(result.pokemon).toHaveLength(1);
    expect(result.pokemon[0]).toEqual({ count: 3, name: "", set: "PAR", number: "089" });
  });
});

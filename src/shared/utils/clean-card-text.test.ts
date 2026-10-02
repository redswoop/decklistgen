import { describe, test, expect } from "bun:test";
import { cleanCardText, cleanTcgdexCardText } from "./clean-card-text.js";

describe("cleanCardText", () => {
  test("energy-symbol spans become {X} tokens", () => {
    expect(cleanCardText(
      'Search your deck for up to 3 <span class="energy-symbol Lightning" title="Lightning">Lightning</span> Energy cards.',
    )).toBe("Search your deck for up to 3 {L} Energy cards.");
    expect(cleanCardText('<span class="energy-symbol Fire" title="Fire">Fire</span>')).toBe("{R}");
    expect(cleanCardText('<span class="energy-symbol Dragon" title="Dragon">Dragon</span>')).toBe("{N}");
  });

  test("<em> reminder text keeps its words, drops the tags (nested too)", () => {
    // Pikachu & Zekrom-GX, Tag Bolt GX — the real 30th-c-008 text.
    const dirty =
      'If this Pokémon has at least 3 extra <span class="energy-symbol Lightning" title="Lightning">Lightning</span> Energy attached to it <em>(in addition to this attack\'s cost)</em>, this attack does 170 damage to 1 of your opponent\'s Benched Pokémon. <em>(Don\'t apply Weakness and Resistance for Benched Pokémon.) (You can\'t use more than 1 <em>GX</em> attack in a game.)</em>';
    expect(cleanCardText(dirty)).toBe(
      "If this Pokémon has at least 3 extra {L} Energy attached to it (in addition to this attack's cost), this attack does 170 damage to 1 of your opponent's Benched Pokémon. (Don't apply Weakness and Resistance for Benched Pokémon.) (You can't use more than 1 GX attack in a game.)",
    );
  });

  test("an unknown energy type span falls back to its inner text", () => {
    expect(cleanCardText('<span class="energy-symbol Plasma" title="Plasma">Plasma</span> Energy')).toBe("Plasma Energy");
  });

  test("clean text and {X} tokens pass through untouched", () => {
    const clean = "Search your deck for a Basic {L} Energy card. 30+ damage if x < y.";
    expect(cleanCardText(clean)).toBe(clean);
    expect(cleanCardText(undefined)).toBeUndefined();
  });
});

describe("cleanTcgdexCardText", () => {
  test("cleans attacks, abilities, effect and description in place without adding keys", () => {
    const raw = {
      attacks: [{ name: "Full Blitz", effect: "<em>x</em>" }, { name: "Plain" }],
      abilities: [{ name: "Power", effect: '<span class="energy-symbol Water" title="Water">Water</span>' }],
    };
    const out = cleanTcgdexCardText(raw);
    expect(out).toBe(raw);
    expect(raw.attacks[0].effect).toBe("x");
    expect("effect" in raw.attacks[1]).toBe(false);
    expect(raw.abilities[0].effect).toBe("{W}");
    expect("effect" in raw).toBe(false);
    expect("description" in raw).toBe(false);
  });
});

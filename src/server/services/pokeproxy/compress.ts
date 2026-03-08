/** Text compression: shorten verbose Pokemon TCG phrasing */
const COMPRESS_RULES: [string, string][] = [
  // === Long phrases first (before sub-phrases get replaced) ===
  // Evolution trigger
  ["When you play this Pokémon from your hand to evolve 1 of your Pokémon during your turn, you may",
   "On evolve:"],
  ["When you play this Pokémon from your hand to evolve 1 of your Pokémon during your turn,",
   "On evolve,"],
  // Knock out — long forms first
  ["is Knocked Out by damage from an attack from your opponent's Pokémon", "is KO'd by opponent"],
  ["were Knocked Out during your opponent's last turn", "were KO'd last turn"],
  ["would be Knocked Out", "would be KO'd"],
  ["is Knocked Out", "is KO'd"],
  ["Knocked Out", "KO'd"],
  // Next turn restrictions
  ["During your next turn, this Pokémon can't attack", "Can't attack next turn"],
  ["During your next turn, this Pokémon can't use", "Can't use next turn:"],
  // Cure
  ["This Pokémon recovers from all Special Conditions", "Cure all conditions"],
  // Switch
  ["Switch your Active Pokémon with 1 of your Benched Pokémon", "Switch Active with Bench"],
  ["1 of your opponent's Benched Pokémon to the Active Spot", "1 of opponent's Bench to Active"],
  // === Pokemon references ===
  ["your opponent's Active Pokémon", "the Defending Pokémon"],
  ["your opponent's Benched Pokémon", "opponent's Bench"],
  ["your Active Pokémon", "your Active"],
  ["your Benched Pokémon", "your Bench"],
  ["to your Pokémon in any way you like", "to your Pokémon however you like"],
  ["this Pokémon", "it"],
  ["This Pokémon", "It"],
  // === Turn / timing ===
  ["Once during your first turn, you may", "First turn, you may"],
  ["Once during your turn", "Once a turn"],
  ["Once during each player's turn, that player may", "Once a turn, each player may"],
  ["As often as you like during your turn, you may", "Any number of times,"],
  ["As often as you like on your turn, you may", "Any number of times,"],
  ["during your turn", "on your turn"],
  // === Search / deck ===
  ["Search your deck for", "Search deck for"],
  ["search your deck for", "search deck for"],
  ["Then, shuffle your deck.", "Shuffle deck."],
  ["then, shuffle your deck.", "shuffle deck."],
  ["Shuffle the other cards back into your deck", "Shuffle the rest back"],
  ["shuffle your deck", "shuffle deck"],
  ["reveal them, and put them into your hand", "and take them"],
  ["reveal it, and put it into your hand", "and take it"],
  ["and put it into your hand", "and take it"],
  ["and put them into your hand", "and take them"],
  ["from your discard pile into your hand", "from discard to hand"],
  ["from your discard pile into your deck", "from discard to deck"],
  ["from your discard pile", "from discard"],
  ["in your discard pile", "in discard"],
  ["into your hand", "to hand"],
  // === Boilerplate clauses ===
  ["If you attached Energy to a Pokémon in this way, ", "If so, "],
  ["If you attached Energy to your Active in this way, ", "If so, "],
  ["Energy card", "Energy"],
  // === Energy ===
  ["Basic Energy cards", "Basic Energy"],
  ["Basic Energy card", "Basic Energy"],
  ["Energy cards", "Energy"],
  ["Energys", "Energy"],
  // === Prize ===
  ["your opponent takes 1 fewer Prize card", "opponent takes 1 fewer Prize"],
  ["Prize card your opponent has taken", "Prize taken"],
  ["Prize cards", "Prizes"],
  ["Prize card", "Prize"],
  // === Play conditions ===
  ["You can use this card only if you discard", "Discard"],
  ["other cards from your hand", "other cards to play"],
  ["another card from your hand", "1 card to play"],
  // === Damage / effects ===
  ["(Don't apply Weakness and Resistance for Benched Pokémon.)", "(Bench damage)"],
  ["(before applying Weakness and Resistance)", ""],
  ["(after applying Weakness and Resistance)", ""],
  ["This attack does", "Does"],
  ["this attack does", "does"],
  ["more damage for each", "+damage per"],
  ["more damage", "extra"],
  ["has any damage counters on it", "has damage"],
  ["has no damage counters on it", "has no damage"],
  ["damage counters", "damage"],
  ["damage on it", "damage"],
  ["damage to itself", "self-damage"],
  // === Status / conditions ===
  ["is now Poisoned", "becomes Poisoned"],
  ["is now Confused", "becomes Confused"],
  ["is now Asleep", "becomes Asleep"],
  ["is now Burned", "becomes Burned"],
  ["is now Paralyzed", "becomes Paralyzed"],
  // === Misc ===
  ["Flip a coin. If heads, ", "Flip: heads, "],
  ["Look at the top", "Check top"],
  ["in order to use this Ability", "to use this"],
  ["You can't use more than 1", "Max 1"],
  ["Ability each turn", "per turn"],
  ["Ability during your turn", "per turn"],
  ["Ability on your turn", "per turn"],
  ["you may draw cards until you have", "draw up to"],
  ["cards in your hand", "cards"],
  // GX
  ["(You can't use more than 1 GX attack in a game.)", "(1 GX per game)"],
  // Stadium third-person
  ["that player may search their deck for", "they may search deck for"],
  ["that player shuffles their deck", "they shuffle deck"],
];

/** Apply shorthand compression rules to card effect text. */
export function compressText(text: string): string {
  // Normalize curly quotes to straight (not in all fonts)
  text = text.replaceAll("\u2018", "'").replaceAll("\u2019", "'")
             .replaceAll("\u201C", '"').replaceAll("\u201D", '"');
  for (const [pattern, replacement] of COMPRESS_RULES) {
    text = text.replaceAll(pattern, replacement);
  }
  // Clean up artifacts from empty replacements
  while (text.includes("  ")) text = text.replaceAll("  ", " ");
  text = text.replaceAll(" .", ".").replaceAll(" ,", ",").replaceAll(" )", ")");
  return text.trim();
}

/**
 * TCGdex has no scans for the 30th Classic Collection (30th-c). Every card in
 * it is a faithful reprint — same art, same text, original frame — so the
 * original printing's scan is a near-exact stand-in. Resolved 2026-10-02 by
 * matching name + HP + attack names + illustrator against TCGdex; drop an
 * entry once upstream ships the real scan (the upstream `image` wins anyway).
 */
export const IMAGE_STAND_INS: Record<string, string> = {
  "30th-c-001": "https://assets.tcgdex.net/en/base/base1/4",      // Charizard — Base Set
  "30th-c-002": "https://assets.tcgdex.net/en/ex/ex1/5",          // Delcatty — Ruby & Sapphire
  "30th-c-003": "https://assets.tcgdex.net/en/ex/ex11/11",        // Metagross δ — Delta Species
  "30th-c-004": "https://assets.tcgdex.net/en/bw/bw10/11",        // Genesect-EX — Plasma Blast
  "30th-c-005": "https://assets.tcgdex.net/en/gym/gym1/18",       // Misty — Gym Heroes
  "30th-c-006": "https://assets.tcgdex.net/en/ex/ex7/19",         // Dark Tyranitar — Team Rocket Returns
  "30th-c-007": "https://assets.tcgdex.net/en/neo/neo1/25",       // Sneasel — Neo Genesis
  "30th-c-008": "https://assets.tcgdex.net/en/sm/sm9/33",         // Pikachu & Zekrom-GX — Team Up
  "30th-c-009": "https://assets.tcgdex.net/en/xy/xy9/41",         // Greninja BREAK — BREAKpoint
  "30th-c-010": "https://assets.tcgdex.net/en/dp/dp6/43",         // Uxie — Legends Awakened
  "30th-c-011": "https://assets.tcgdex.net/en/pl/pl1/47",         // Crobat G — Platinum
  "30th-c-012": "https://assets.tcgdex.net/en/swsh/swsh4/50",     // Raikou (Amazing Rare) — Vivid Voltage
  "30th-c-013": "https://assets.tcgdex.net/en/sm/sm4/57",         // Buzzwole-GX — Crimson Invasion
  "30th-c-014": "https://assets.tcgdex.net/en/base/base1/58",     // Pikachu — Base Set
  "30th-c-015": "https://assets.tcgdex.net/en/gym/gym2/69",       // Erika's Jigglypuff — Gym Challenge
  "30th-c-016": "https://assets.tcgdex.net/en/bw/bw6/85",         // Rayquaza-EX — Dragons Exalted
  "30th-c-017": "https://assets.tcgdex.net/en/sm/sm1/89",         // Solgaleo-GX — Sun & Moon
  "30th-c-018": "https://assets.tcgdex.net/en/hgss/hgss4/94",     // Gengar — Triumphant
  "30th-c-019": "https://assets.tcgdex.net/en/hgss/hgss4/99",     // Darkrai & Cresselia LEGEND (top) — Triumphant
  "30th-c-020": "https://assets.tcgdex.net/en/hgss/hgss4/100",    // Darkrai & Cresselia LEGEND (bottom) — Triumphant
  "30th-c-021": "https://assets.tcgdex.net/en/bw/bw3/92",         // N — Noble Victories
  "30th-c-022": "https://assets.tcgdex.net/en/dp/dp4/106",        // Palkia — Great Encounters
  "30th-c-023": "https://assets.tcgdex.net/en/xy/xy5/106",        // M Gardevoir-EX — Primal Clash
  "30th-c-024": "https://assets.tcgdex.net/en/neo/neo4/106",      // Shining Celebi — Neo Destiny
  "30th-c-025": "https://assets.tcgdex.net/en/ex/ex10/108",       // Scizor ex — Unseen Forces
  "30th-c-026": "https://assets.tcgdex.net/en/swsh/swsh8/114",    // Mew VMAX — Fusion Strike
  "30th-c-027": "https://assets.tcgdex.net/en/swsh/swsh9/123",    // Arceus VSTAR — Brilliant Stars
  "30th-c-028": "https://assets.tcgdex.net/en/swsh/swsh1/138",    // Zacian V — Sword & Shield
  "30th-c-029": "https://assets.tcgdex.net/en/ecard/ecard2/149",  // Lugia (Crystal) — Aquapolis
  "30th-c-030": "https://assets.tcgdex.net/en/sv/sv02/203",       // Magikarp (Illustration Rare) — Paldea Evolved
};

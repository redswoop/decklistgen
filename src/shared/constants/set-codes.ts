/** Maps PTCGL-style set codes to TCGdex set IDs */
export const SET_MAP: Record<string, string> = {
  // Scarlet & Violet era
  SVI: "sv01",
  SV: "sv01",
  PAL: "sv02",
  OBF: "sv03",
  MEW: "sv03.5",
  PAR: "sv04",
  SV4: "sv04",
  PAF: "sv04.5",
  TEF: "sv05",
  TWM: "sv06",
  SFA: "sv06.5",
  SCR: "sv07",
  SSP: "sv08",
  PRE: "sv08.5",
  JTG: "sv09",
  DRI: "sv10",
  WFL: "sv10.5w",
  BBT: "sv10.5b",
  BLK: "sv10.5b",
  WHT: "sv10.5w",
  SVP: "svp",
  SVE: "sve",
  // Mega Evolution era
  MEG: "me01",
  PFL: "me02",
  ASC: "me02.5",
  POR: "me03",
  CRI: "me04",
  PBL: "me05",
  // 30th anniversary. PTCGL/Limitless file both halves under 30C, with the
  // Classic Collection numbered CC1–CC30 — see canonicalSetNumber().
  "30C": "30th",
  "30CC": "30th-c",
  MEE: "mee",  // Mega Evolution Energy — ME-era basic energies (8 cards)
  MEP: "mep",
  // Sword & Shield era
  SWSH: "swsh1",
  SSH: "swsh1",
  RCL: "swsh2",
  DAA: "swsh3",
  CPA: "swsh3.5",
  VIV: "swsh4",
  SHF: "swsh4.5",
  BST: "swsh5",
  CRE: "swsh6",
  EVS: "swsh7",
  CEL: "cel25",
  FST: "swsh8",
  BRS: "swsh9",
  ASR: "swsh10",
  PGO: "swsh10.5",
  LOR: "swsh11",
  SIT: "swsh12",
  CRZ: "swsh12.5",
  SWSHP: "swshp",
  FUT20: "fut2020",
};

/** Human-readable set names keyed by PTCGL code */
export const SET_NAMES: Record<string, string> = {
  SVI: "Scarlet & Violet",
  SV: "Scarlet & Violet",
  PAL: "Paldea Evolved",
  OBF: "Obsidian Flames",
  MEW: "151",
  PAR: "Paradox Rift",
  SV4: "Paradox Rift",
  PAF: "Paldean Fates",
  TEF: "Temporal Forces",
  TWM: "Twilight Masquerade",
  SFA: "Shrouded Fable",
  SCR: "Stellar Crown",
  SSP: "Surging Sparks",
  PRE: "Prismatic Evolutions",
  JTG: "Journey Together",
  DRI: "Destined Rivals",
  WFL: "Battle Friends (Wugtrio)",
  BBT: "Battle Friends (Baxcalibur)",
  BLK: "Black Bolt",
  WHT: "White Flare",
  SVP: "SV Black Star Promos",
  SVE: "SV Energies",
  MEE: "Mega Evolution Energy",
  MEG: "Mega Evolution",
  PFL: "Phantasmal Flames",
  ASC: "Ascended Heroes",
  POR: "Perfect Order",
  CRI: "Chaos Rising",
  PBL: "Pitch Black",
  "30C": "30th Celebration",
  "30CC": "30th Classic Collection",
  MEP: "MEP Black Star Promos",
  SWSH: "Sword & Shield",
  SSH: "Sword & Shield",
  RCL: "Rebel Clash",
  DAA: "Darkness Ablaze",
  CPA: "Champion's Path",
  VIV: "Vivid Voltage",
  SHF: "Shining Fates",
  BST: "Battle Styles",
  CRE: "Chilling Reign",
  EVS: "Evolving Skies",
  CEL: "Celebrations",
  FST: "Fusion Strike",
  BRS: "Brilliant Stars",
  ASR: "Astral Radiance",
  PGO: "Pokemon GO",
  LOR: "Lost Origin",
  SIT: "Silver Tempest",
  CRZ: "Crown Zenith",
  SWSHP: "SWSH Black Star Promos",
  FUT20: "Futsal 2020",
};

/** Reverse map: TCGdex ID → PTCGL code (first match) */
export const REVERSE_SET_MAP: Record<string, string> = {};
for (const [code, id] of Object.entries(SET_MAP)) {
  if (!(id in REVERSE_SET_MAP)) {
    REVERSE_SET_MAP[id] = code;
  }
}

/** Determine era from TCGdex set ID */
export function getEra(tcgdexId: string): "sv" | "swsh" | "me" {
  // 30th / 30th-c sit in TCGdex's Mega Evolution serie despite the odd IDs
  if (tcgdexId.startsWith("me") || tcgdexId.startsWith("30th")) return "me";
  if (tcgdexId.startsWith("sv")) return "sv";
  return "swsh";
}

/** Sub-sets that decklists file under a parent code with a number prefix ("30C CC12") */
const NUMBER_PREFIX_SUBSETS: Record<string, Record<string, string>> = {
  "30C": { CC: "30CC" },
};

/** Route a decklist (set code, number) pair to the set that actually holds the card */
export function canonicalSetNumber(setCode: string, number: string): { setCode: string; number: string } {
  const code = setCode.toUpperCase();
  const prefixed = number.toUpperCase().match(/^([A-Z]+)(\d+)$/);
  const subset = prefixed && NUMBER_PREFIX_SUBSETS[code]?.[prefixed[1]];
  if (subset) return { setCode: subset, number: prefixed[2] };
  return { setCode: code, number };
}

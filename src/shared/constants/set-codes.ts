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
  MEE: "sve",  // Limitless basic energies → SV Energies fallback
  // Mega Evolution era
  MEG: "me01",
  PFL: "me02",
  ASC: "me02.5",
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
  MEE: "Basic Energies",
  MEG: "Mega Evolution",
  PFL: "Phantasmal Flames",
  ASC: "Ascended Heroes",
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
export function getEra(tcgdexId: string): "sv" | "swsh" {
  if (tcgdexId.startsWith("sv") || tcgdexId.startsWith("sve")) return "sv";
  return "swsh";
}

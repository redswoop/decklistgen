/** Shared types for template-based card renderers. */

export interface CardProps {
  // Identity
  name: string;           // escaped for XML
  rawName: string;        // original (for splitting)
  baseName: string;       // "Arcanine" (without suffix)
  nameSuffix: string;     // "ex", "V", "VMAX", "VSTAR", ""
  mainName: string;       // "Professor's Research" (without subtitle)
  subtitle: string;       // "Professor Sada" or ""
  suffix: string;         // getPokemonSuffix() result

  // Card data
  hp: number | undefined;
  types: string[];
  cardType: string;       // types[0] ?? "Colorless"
  color: string;          // TYPE_COLORS[cardType] or trainer color
  category: string;       // "Pokemon" | "Trainer" | "Energy"
  trainerType: string;    // "Supporter" | "Item" | "Stadium" | "Tool" | ""
  stage: string;
  evolveFrom: string;
  retreat: number;
  setName: string;
  localId: string;

  // Content (already compressed)
  trainerEffect: string;
  abilities: Array<{ type: string; name: string; effect: string }>;
  attacks: Array<{ name: string; damage: string; cost: string[]; effect: string }>;

  // Solved layout (from sizing algorithm)
  layout: SolvedLayout;

  // Image
  imageB64: string;

  // Raw card (for footer weakness/resistance lookup)
  card: Record<string, unknown>;
}

export interface SolvedLayout {
  bodySize: number;
  headSize: number;
  lineH: number;
  // Standard-specific
  artHeight?: number;
  artY?: number;
  // Fullart-specific
  overlayTop?: number;
}

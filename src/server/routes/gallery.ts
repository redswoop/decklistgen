import { Hono } from "hono";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isFullArt } from "../../shared/utils/detect-fullart.js";
import { getPromptForCard, saveCardPrompt } from "../services/prompt-db.js";
import { getCard, loadSet, isSetLoaded } from "../services/card-store.js";
import { REVERSE_SET_MAP } from "../../shared/constants/set-codes.js";
import type { TcgdexCard } from "../../shared/types/card.js";
import { getRawPalettes, savePalettes, resetPalettes } from "../services/pokeproxy/energy-palette-store.js";
import { ENERGY_COLORS_DARK, ENERGY_COLORS_LIGHT } from "../services/pokeproxy/constants.js";
import { getFontStyle } from "../services/pokeproxy/type-icons.js";

const CACHE_DIR = join(import.meta.dir, "../../../cache");

/** Load card data from cached JSON file */
function loadCachedCard(cardId: string): Record<string, unknown> | null {
  const jsonPath = join(CACHE_DIR, `${cardId}.json`);
  if (!existsSync(jsonPath)) return null;
  try {
    const text = readFileSync(jsonPath, "utf-8");
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const TEST_CARDS = [
  // Standard Pokemon (white background, art window)
  { label: "PokemonBasic", cardId: "sv01-001" },
  { label: "PokemonStage1", cardId: "sv01-006" },
  { label: "PokemonStage2", cardId: "cel25-15" },
  // Full-art Pokemon (full-bleed art, overlay text)
  { label: "PokemonEX", cardId: "sv01-019" },
  { label: "PokemonEX Stage2", cardId: "sv01-065" },
  { label: "PokemonEX Ultra", cardId: "sv01-231" },
  { label: "PokemonV", cardId: "cel25-16" },
  { label: "PokemonVMAX", cardId: "cel25-7" },
  { label: "Illustration Rare", cardId: "sv01-207" },
  // Trainers
  { label: "TrainerItem", cardId: "sv01-172" },
  { label: "TrainerSupporter", cardId: "sv01-175" },
  { label: "TrainerStadium", cardId: "sv03-196" },
  { label: "TrainerTool", cardId: "sv02-173" },
  { label: "Trainer FullArt", cardId: "cel25-24" },
  // Additional fullart types
  { label: "PokemonVSTAR", cardId: "swsh12.5-019" },
  { label: "PokemonDragon EX", cardId: "sv08.5-073" },
  { label: "PokemonDragon std", cardId: "sv06.5-045" },
  { label: "Pokemon Text-Heavy", cardId: "cel25-21" },
  // Energy
  { label: "EnergyBasic Dark", cardId: "sv06.5-098" },
  { label: "EnergyBasic Metal", cardId: "sv06.5-099" },
  { label: "EnergySpecial", cardId: "sv09-190" },
];

const app = new Hono();

/** Return test card list with metadata */
app.get("/cards", async (c) => {
  // Auto-load any sets needed by gallery test cards
  const setsNeeded = new Set<string>();
  for (const { cardId } of TEST_CARDS) {
    const setId = cardId.replace(/-[^-]+$/, "");
    const setCode = REVERSE_SET_MAP[setId];
    if (setCode && !isSetLoaded(setCode)) setsNeeded.add(setCode);
  }
  for (const code of setsNeeded) {
    try { await loadSet(code); } catch {}
  }

  const cards = TEST_CARDS.map(({ label, cardId }) => {
    const cached = loadCachedCard(cardId);
    const storeCard = getCard(cardId);
    const card = cached ?? (storeCard ? {
      id: storeCard.id,
      localId: storeCard.localId,
      name: storeCard.name,
      category: storeCard.category,
      hp: storeCard.hp,
      types: storeCard.energyTypes,
      stage: storeCard.stage,
      retreat: storeCard.retreat,
      rarity: storeCard.rarity,
      trainerType: storeCard.trainerType,
      set: { name: storeCard.setName, id: storeCard.setId },
    } : null);
    const hasClean = existsSync(join(CACHE_DIR, `${cardId}_clean.png`));
    const hasComposite = existsSync(join(CACHE_DIR, `${cardId}_composite.png`));
    const hasSvg = existsSync(join(CACHE_DIR, `${cardId}.svg`));
    const hasSource = existsSync(join(CACHE_DIR, `${cardId}.png`));
    // Load clean metadata if it exists
    let cleanMeta: Record<string, unknown> | null = null;
    const metaPath = join(CACHE_DIR, `${cardId}_clean_meta.json`);
    if (existsSync(metaPath)) {
      try {
        cleanMeta = JSON.parse(readFileSync(metaPath, "utf-8"));
      } catch {}
    }
    // Get the prompt that would be used if cleaned now
    const promptResult = card ? getPromptForCard(card) : null;

    return {
      label,
      cardId,
      name: (card?.name as string) ?? cardId,
      category: (card?.category as string) ?? "?",
      stage: (card?.stage as string) ?? null,
      hp: (card?.hp as number) ?? null,
      rarity: (card?.rarity as string) ?? null,
      energyTypes: (card?.types as string[]) ?? [],
      isFullArt: card ? isFullArt(card as TcgdexCard) : false,
      hasClean,
      hasComposite,
      hasSvg,
      hasSource,
      cleanMeta,
      promptRule: promptResult?.ruleName ?? null,
      promptText: promptResult?.prompt ?? null,
      promptSkip: promptResult?.skip ?? false,
    };
  });
  return c.json(cards);
});

/** Save a card-specific prompt to the database */
app.post("/prompt/:cardId", async (c) => {
  const cardId = c.req.param("cardId");
  const { prompt } = await c.req.json<{ prompt: string }>();
  if (!prompt || typeof prompt !== "string") {
    return c.json({ error: "prompt is required" }, 400);
  }
  saveCardPrompt(cardId, prompt.trim());
  return c.json({ cardId, status: "saved", prompt: prompt.trim() });
});

/** Filter palette to single-letter keys only */
function letterKeysOnly(palette: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(palette)) {
    if (k.length === 1) result[k] = v;
  }
  return result;
}

/** Get current + default palettes */
app.get("/palettes", (c) => {
  return c.json({
    current: getRawPalettes(),
    defaults: {
      dark: letterKeysOnly(ENERGY_COLORS_DARK),
      light: letterKeysOnly(ENERGY_COLORS_LIGHT),
    },
  });
});

/** Save custom palettes */
app.put("/palettes", async (c) => {
  const { dark, light } = await c.req.json<{ dark: Record<string, string>; light: Record<string, string> }>();
  savePalettes(dark, light);
  return c.json({ status: "saved" });
});

/** Reset palettes to defaults */
app.delete("/palettes", (c) => {
  resetPalettes();
  return c.json({ status: "reset" });
});

/** Serve gallery HTML page */
app.get("/", (c) => {
  return c.html(galleryHtml());
});

function galleryHtml(): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Pokeproxy Gallery</title>
<style>
  ${getFontStyle().replace(/<\/?style>/g, '')}
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #1a1a2e;
    color: #eee;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    padding: 24px;
  }
  h1 {
    text-align: center;
    margin-bottom: 4px;
    font-size: 24px;
    color: #fff;
  }
  .subtitle {
    text-align: center;
    color: #aaa;
    font-size: 13px;
    margin-bottom: 12px;
  }
  .gallery {
    display: flex;
    flex-wrap: wrap;
    gap: 24px;
    justify-content: center;
  }
  .card {
    background: #16213e;
    border-radius: 12px;
    padding: 12px;
    width: 280px;
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    transition: transform 0.15s, box-shadow 0.15s;
  }
  .card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
  }
  .card.loading { opacity: 0.6; }
  .label {
    font-weight: 700;
    font-size: 14px;
    color: #f39c12;
    margin-bottom: 4px;
  }
  .card-name {
    font-size: 15px;
    font-weight: 600;
    color: #fff;
  }
  .card-id {
    font-size: 12px;
    color: #888;
    margin-bottom: 4px;
  }
  .badges {
    display: flex;
    gap: 6px;
    margin-bottom: 4px;
  }
  .badge {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    text-transform: uppercase;
  }
  .badge.standard { background: #2d3748; color: #a0aec0; }
  .badge.fullart { background: #553c9a; color: #d6bcfa; }
  .badge.clean { background: #276749; color: #9ae6b4; }
  .meta {
    font-size: 11px;
    color: #aaa;
    text-align: center;
    margin-bottom: 8px;
    line-height: 1.4;
  }
  .svg-container {
    width: 250px;
    height: 350px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .svg-container svg {
    width: 100%;
    height: 100%;
  }
  .svg-container .placeholder {
    color: #555;
    font-size: 13px;
  }

  /* Lightbox */
  .lightbox {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.85);
    z-index: 1000;
    overflow-y: auto;
  }
  .lightbox.active { display: block; }
  .lightbox-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-height: 100vh;
    padding: 48px 24px 24px;
    gap: 20px;
  }
  .lightbox-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    max-width: 1200px;
  }
  .lightbox-panels {
    display: flex;
    justify-content: center;
    gap: 24px;
    flex-wrap: wrap;
  }
  .lightbox-panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }
  .lightbox-panel-label {
    font-size: 13px;
    font-weight: 700;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .lightbox-panel img,
  .lightbox-panel .lightbox-svg {
    height: 60vh;
    width: auto;
    border-radius: 12px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.5);
  }
  .lightbox-panel .lightbox-svg svg {
    height: 60vh;
    width: auto;
    display: block;
  }
  .lightbox-close {
    font-size: 32px;
    color: #888;
    cursor: pointer;
    line-height: 1;
    background: none;
    border: none;
  }
  .energy-picker-section {
    margin: 0 auto 24px;
    max-width: 900px;
  }
  .energy-picker-section h2 {
    font-size: 14px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #888;
    margin-bottom: 12px;
  }
  .palette-box {
    border-radius: 10px;
    padding: 16px 20px;
    margin-bottom: 12px;
  }
  .palette-box.dark-palette { background: #f5f5f5; }
  .palette-box.light-palette { background: #1a1a2e; }
  .palette-label {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 10px;
  }
  .dark-palette .palette-label { color: #666; }
  .light-palette .palette-label { color: #888; }
  .glyph-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 10px;
  }
  .glyph-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    width: 62px;
  }
  .glyph-char {
    font-family: "EssentiarumTCG", sans-serif;
    font-size: 28px;
    line-height: 1;
  }
  .glyph-name {
    font-size: 10px;
    font-weight: 600;
  }
  .dark-palette .glyph-name { color: #666; }
  .light-palette .glyph-name { color: #aaa; }
  .glyph-item input[type="color"] {
    width: 32px;
    height: 22px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    padding: 0;
    background: none;
  }
  .sample-line {
    font-size: 14px;
    margin-top: 6px;
    line-height: 1.6;
  }
  .dark-palette .sample-line { color: #333; }
  .light-palette .sample-line { color: #eee; }
  .palette-actions {
    display: flex;
    gap: 10px;
    align-items: center;
    margin-top: 8px;
  }
  .palette-actions button {
    padding: 6px 16px;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
  }
  .btn-save-palette { background: #f39c12; color: #000; }
  .btn-save-palette:hover { background: #e67e22; }
  .btn-reset-palette { background: #444; color: #ccc; }
  .btn-reset-palette:hover { background: #555; }
  .palette-status { font-size: 12px; color: #9ae6b4; }
  .mode-tabs {
    display: flex;
    justify-content: center;
    gap: 0;
    margin-bottom: 20px;
  }
  .mode-tab {
    padding: 10px 32px;
    border: 2px solid #444;
    background: transparent;
    color: #888;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s;
  }
  .mode-tab:first-child {
    border-radius: 24px 0 0 24px;
  }
  .mode-tab:last-child {
    border-radius: 0 24px 24px 0;
    border-left: none;
  }
  .mode-tab.active {
    background: #f39c12;
    border-color: #f39c12;
    color: #000;
  }
  .mode-tab:not(.active):hover {
    border-color: #666;
    color: #ccc;
  }
  .preview-cards {
    margin-top: 12px;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 13px;
    line-height: 1.9;
  }
  .dark-palette .preview-cards {
    background: #e8e8e8;
    color: #333;
  }
  .light-palette .preview-cards {
    background: #111122;
    color: #ddd;
  }
  .card-previews {
    display: flex;
    gap: 12px;
    margin-top: 12px;
    flex-wrap: wrap;
  }
  .card-preview {
    width: 200px;
    height: 280px;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    background: #222;
    flex-shrink: 0;
  }
  .card-preview svg {
    width: 100%;
    height: 100%;
  }
  .card-preview .placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    color: #555;
    font-size: 11px;
  }
  .lightbox-close:hover { color: #fff; }
  .lightbox-title {
    font-size: 18px;
    font-weight: 700;
    color: #fff;
  }
  .lightbox-bottom {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    width: 100%;
    max-width: 800px;
  }
  .lightbox-actions {
    display: flex;
    gap: 12px;
  }
  .prompt-info {
    width: 100%;
    background: rgba(22, 33, 62, 0.95);
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 12px;
    line-height: 1.5;
  }
  .prompt-info .prompt-label {
    color: #f39c12;
    font-weight: 700;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }
  .prompt-info .prompt-meta {
    color: #888;
    font-size: 11px;
    margin-top: 4px;
  }
  .prompt-info textarea {
    width: 100%;
    min-height: 48px;
    max-height: 100px;
    background: #0d1117;
    color: #ccc;
    border: 1px solid #333;
    border-radius: 6px;
    padding: 8px;
    font-family: inherit;
    font-size: 12px;
    line-height: 1.4;
    resize: vertical;
  }
  .prompt-info textarea:focus {
    outline: none;
    border-color: #f39c12;
  }
  .prompt-actions {
    display: flex;
    gap: 8px;
    margin-top: 6px;
    align-items: center;
  }
  .prompt-actions button {
    padding: 4px 12px;
    border: none;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
  }
  .btn-save-prompt { background: #f39c12; color: #000; }
  .btn-save-prompt:hover { background: #e67e22; }
  .prompt-save-status {
    font-size: 11px;
    color: #9ae6b4;
  }
  .lightbox-actions button {
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.2s;
  }
  .lightbox-actions button:hover { opacity: 0.85; }
  .lightbox-actions button:disabled { opacity: 0.4; cursor: wait; }
  .btn-clean { background: #276749; color: #9ae6b4; }
  .btn-regen { background: #553c9a; color: #d6bcfa; }
  .btn-force-clean { background: #9b2c2c; color: #fed7d7; }
  .badge.expanded { background: #2b6cb0; color: #bee3f8; }
  .lightbox-status {
    font-size: 13px;
    color: #aaa;
    text-align: center;
  }
</style>
</head>
<body>
  <h1>Pokeproxy Gallery</h1>
  <div class="subtitle"></div>
  <div class="mode-tabs">
    <button class="mode-tab" data-mode="cards" onclick="setMode('cards')">Cards</button>
    <button class="mode-tab" data-mode="glyphs" onclick="setMode('glyphs')">Glyphs</button>
  </div>
  <div id="view-glyphs" style="display:none">
  <div class="energy-picker-section">
    <h2>Energy Glyphs</h2>
    <div class="palette-box dark-palette">
      <div class="palette-label">Standard (dark text on white)</div>
      <div class="glyph-grid" id="grid-dark"></div>
      <div class="sample-line" id="sample-dark"></div>
      <div class="preview-cards" id="preview-dark"></div>
      <div class="card-previews" id="cards-dark"></div>
    </div>
    <div class="palette-box light-palette">
      <div class="palette-label">Full-art (white text on dark)</div>
      <div class="glyph-grid" id="grid-light"></div>
      <div class="sample-line" id="sample-light"></div>
      <div class="preview-cards" id="preview-light"></div>
      <div class="card-previews" id="cards-light"></div>
    </div>
    <div class="palette-actions">
      <button class="btn-save-palette" onclick="savePalettes()">Save Palettes</button>
      <button class="btn-reset-palette" onclick="resetPalettes()">Reset to Defaults</button>
      <span class="palette-status" id="palette-status"></span>
    </div>
  </div>
  </div>
  <div id="view-cards" style="display:none">
  <div class="gallery" id="gallery"></div>
  </div>

  <div class="lightbox" id="lightbox" onclick="closeLightbox(event)">
    <div class="lightbox-inner" onclick="event.stopPropagation()">
      <div class="lightbox-header">
        <div class="lightbox-title" id="lightbox-title"></div>
        <button class="lightbox-close" onclick="closeLightbox()">&times;</button>
      </div>
      <div class="lightbox-panels">
        <div class="lightbox-panel">
          <div class="lightbox-panel-label">Source</div>
          <img id="lightbox-src" src="" />
        </div>
        <div class="lightbox-panel" id="lightbox-clean-panel" style="display:none">
          <div class="lightbox-panel-label">Cleaned</div>
          <img id="lightbox-clean" src="" />
        </div>
        <div class="lightbox-panel">
          <div class="lightbox-panel-label">SVG</div>
          <div class="lightbox-svg" id="lightbox-svg"></div>
        </div>
      </div>
      <div class="lightbox-bottom">
        <div class="lightbox-status" id="lightbox-status"></div>
        <div class="lightbox-actions">
          <button class="btn-clean" onclick="doClean(false)">Clean (ComfyUI)</button>
          <button class="btn-force-clean" onclick="doClean(true)">Force Re-clean</button>
          <button class="btn-regen" onclick="doRegen()">Regen SVG</button>
        </div>
        <div class="prompt-info" id="prompt-info"></div>
      </div>
    </div>
  </div>

<script>
let currentCardId = null;
let cardData = {};

// ── Energy palette picker ──
const ENERGY_TYPES = [
  { letter: 'G', name: 'Grass' }, { letter: 'R', name: 'Fire' },
  { letter: 'W', name: 'Water' }, { letter: 'L', name: 'Lightning' },
  { letter: 'P', name: 'Psychic' }, { letter: 'F', name: 'Fighting' },
  { letter: 'D', name: 'Darkness' }, { letter: 'M', name: 'Metal' },
  { letter: 'Y', name: 'Fairy' }, { letter: 'N', name: 'Dragon' },
  { letter: 'C', name: 'Colorless' },
];
let palettes = { dark: {}, light: {} };
let defaults = { dark: {}, light: {} };
const SAMPLE_TEXT = '{G} Grass  {R} Fire  {W} Water  {L} Lightning  {P} Psychic  {F} Fighting  {D} Darkness  {M} Metal  {Y} Fairy  {N} Dragon  {C} Colorless';

const PREVIEW_LINES = [
  '{G}{C}{C}  Leaf Storm          130',
  '{R}{R}  Flamethrower           120',
  '    Discard {R} Energy.',
  '{W}{P}  Mystic Surge            90',
  '    +20 for each {F}{L}{D} attached.',
  'Weakness: {Y}{N}   Retreat: {M}{C}',
];

const PREVIEW_CARD_IDS = {
  dark: [
    'swsh5-95',       // Houndour — darkest standard bg
    'sv01-006',       // Spidops — mid standard
    'sv01-172',       // Energy Search — bright standard
    'swsh1-177',      // Potion — brightest standard bg
  ],
  light: [
    'sv10.5b-172',    // Zekrom ex — darkest full-art bg
    'swsh8-156',      // Gengar V — dark full-art
    'swsh12.5-GG37',  // Simisear VSTAR — bright full-art
    'sv10.5w-173',    // Reshiram ex — brightest full-art bg
  ],
};

async function loadCardPreviews(paletteKey) {
  const container = document.getElementById('cards-' + paletteKey);
  if (!container) return;
  const ids = PREVIEW_CARD_IDS[paletteKey] || [];
  container.innerHTML = ids.map(function() {
    return '<div class="card-preview"><div class="placeholder">Loading...</div></div>';
  }).join('');
  const slots = container.querySelectorAll('.card-preview');
  for (let i = 0; i < ids.length; i++) {
    try {
      const resp = await fetch('/api/pokeproxy/svg/' + ids[i] + '?synth&t=' + Date.now());
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      slots[i].innerHTML = await resp.text();
    } catch (e) {
      slots[i].textContent = 'Failed: ' + e.message;
    }
  }
}

function renderPreview(containerId, paletteKey) {
  const container = document.getElementById(containerId);
  if (!container) return;
  let html = '';
  for (const line of PREVIEW_LINES) {
    html += '<div>';
    let i = 0;
    while (i < line.length) {
      if (line[i] === '{') {
        const end = line.indexOf('}', i);
        if (end > i) {
          const letter = line.substring(i + 1, end);
          const color = palettes[paletteKey][letter] || '#888';
          if (letter === 'N') {
            html += '<span style="color:' + color + '">\\u25CF</span>';
          } else {
            html += '<span style="color:' + color + ';font-family:EssentiarumTCG">' + letter + '</span>';
          }
          i = end + 1;
          continue;
        }
      }
      html += esc(line[i]);
      i++;
    }
    html += '</div>';
  }
  container.innerHTML = html;
}

async function initPalettes() {
  try {
    const resp = await fetch('/gallery/palettes');
    const data = await resp.json();
    defaults = data.defaults;
    palettes = {
      dark: { ...data.defaults.dark, ...data.current.dark },
      light: { ...data.defaults.light, ...data.current.light },
    };
  } catch {
    palettes = { dark: {}, light: {} };
  }
  buildGlyphGrid('grid-dark', 'dark');
  buildGlyphGrid('grid-light', 'light');
  renderSampleLine('sample-dark', 'dark');
  renderSampleLine('sample-light', 'light');
  renderPreview('preview-dark', 'dark');
  renderPreview('preview-light', 'light');
  loadCardPreviews('dark');
  loadCardPreviews('light');
}

function buildGlyphGrid(containerId, paletteKey) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  for (const t of ENERGY_TYPES) {
    const color = palettes[paletteKey][t.letter] || '#888';
    const item = document.createElement('div');
    item.className = 'glyph-item';

    const glyphSpan = document.createElement('span');
    glyphSpan.className = 'glyph-char';
    glyphSpan.style.color = color;
    glyphSpan.id = 'glyph-' + paletteKey + '-' + t.letter;
    if (t.letter === 'N') {
      glyphSpan.textContent = '\\u25CF';
      glyphSpan.style.fontFamily = 'sans-serif';
    } else {
      glyphSpan.textContent = t.letter;
    }

    const nameSpan = document.createElement('span');
    nameSpan.className = 'glyph-name';
    nameSpan.textContent = t.name;

    const input = document.createElement('input');
    input.type = 'color';
    input.value = color;
    input.dataset.letter = t.letter;
    input.dataset.palette = paletteKey;
    input.addEventListener('input', function() {
      palettes[paletteKey][this.dataset.letter] = this.value;
      const g = document.getElementById('glyph-' + paletteKey + '-' + this.dataset.letter);
      if (g) g.style.color = this.value;
      renderSampleLine('sample-' + paletteKey, paletteKey);
      renderPreview('preview-' + paletteKey, paletteKey);
    });

    item.appendChild(glyphSpan);
    item.appendChild(nameSpan);
    item.appendChild(input);
    container.appendChild(item);
  }
}

function renderSampleLine(containerId, paletteKey) {
  const container = document.getElementById(containerId);
  let html = '';
  let i = 0;
  while (i < SAMPLE_TEXT.length) {
    if (SAMPLE_TEXT[i] === '{') {
      const end = SAMPLE_TEXT.indexOf('}', i);
      if (end > i) {
        const letter = SAMPLE_TEXT.substring(i + 1, end);
        const color = palettes[paletteKey][letter] || '#888';
        if (letter === 'N') {
          html += '<span style="color:' + color + '">\\u25CF</span>';
        } else {
          html += '<span style="color:' + color + ';font-family:EssentiarumTCG">' + letter + '</span>';
        }
        i = end + 1;
        continue;
      }
    }
    html += esc(SAMPLE_TEXT[i]);
    i++;
  }
  container.innerHTML = html;
}

async function savePalettes() {
  const statusEl = document.getElementById('palette-status');
  statusEl.textContent = 'Saving...';
  statusEl.style.color = '#aaa';
  try {
    const resp = await fetch('/gallery/palettes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dark: palettes.dark, light: palettes.light }),
    });
    const data = await resp.json();
    if (data.status === 'saved') {
      statusEl.textContent = 'Saved!';
      statusEl.style.color = '#9ae6b4';
      loadCardPreviews('dark');
      loadCardPreviews('light');
    } else {
      statusEl.textContent = 'Error';
      statusEl.style.color = '#fc8181';
    }
  } catch (e) {
    statusEl.textContent = 'Error: ' + e.message;
    statusEl.style.color = '#fc8181';
  }
}

async function resetPalettes() {
  const statusEl = document.getElementById('palette-status');
  statusEl.textContent = 'Resetting...';
  statusEl.style.color = '#aaa';
  try {
    await fetch('/gallery/palettes', { method: 'DELETE' });
    palettes = { dark: { ...defaults.dark }, light: { ...defaults.light } };
    buildGlyphGrid('grid-dark', 'dark');
    buildGlyphGrid('grid-light', 'light');
    renderSampleLine('sample-dark', 'dark');
    renderSampleLine('sample-light', 'light');
    renderPreview('preview-dark', 'dark');
    renderPreview('preview-light', 'light');
    loadCardPreviews('dark');
    loadCardPreviews('light');
    statusEl.textContent = 'Reset to defaults';
    statusEl.style.color = '#9ae6b4';
  } catch (e) {
    statusEl.textContent = 'Error: ' + e.message;
    statusEl.style.color = '#fc8181';
  }
}

function svgUrl(cardId) {
  return '/api/pokeproxy/svg/' + cardId + '?t=' + Date.now();
}

async function init() {
  const resp = await fetch('/gallery/cards');
  const cards = await resp.json();
  document.querySelector('.subtitle').textContent = cards.length + ' test cards';

  const gallery = document.getElementById('gallery');
  for (const card of cards) {
    cardData[card.cardId] = card;
    const el = document.createElement('div');
    el.className = 'card loading';
    el.dataset.cardId = card.cardId;
    el.onclick = () => showPreview(card.cardId);

    const badges = [];
    if (card.hasClean) {
      var badgeClass = card.isFullArt ? 'clean' : 'expanded';
      var badgeText = card.isFullArt ? 'CLEANED' : 'EXPANDED';
      badges.push('<span class="badge ' + badgeClass + '">' + badgeText + '</span>');
    }
    badges.push('<span class="badge ' + (card.isFullArt ? 'fullart' : 'standard') + '">' +
      (card.isFullArt ? 'FULLART' : 'STANDARD') + '</span>');

    const meta = [card.category, card.stage, card.hp ? 'HP ' + card.hp : null,
      (card.energyTypes || []).join(', ') || null, card.rarity].filter(Boolean).join(' | ');

    el.innerHTML =
      '<div class="label">' + esc(card.label) + '</div>' +
      '<div class="card-name">' + esc(card.name) + '</div>' +
      '<div class="card-id">' + esc(card.cardId) + '</div>' +
      '<div class="badges" id="badges_' + cssId(card.cardId) + '">' + badges.join('') + '</div>' +
      '<div class="meta">' + esc(meta) + '</div>' +
      '<div class="svg-container" id="svg_' + cssId(card.cardId) + '">' +
        '<span class="placeholder">Loading SVG...</span></div>';
    gallery.appendChild(el);

    // Load SVG async
    loadSvg(card.cardId);
  }
}

function cssId(cardId) {
  return cardId.replace(/[^a-zA-Z0-9]/g, '_');
}

async function loadSvg(cardId) {
  const container = document.getElementById('svg_' + cssId(cardId));
  const cardEl = document.querySelector('[data-card-id="' + cardId + '"]');
  container.innerHTML = '<span class="placeholder">Loading SVG...</span>';
  cardEl.classList.add('loading');
  try {
    const resp = await fetch(svgUrl(cardId));
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    container.innerHTML = await resp.text();
    cardEl.classList.remove('loading');
  } catch (e) {
    container.textContent = 'Failed: ' + e.message;
    cardEl.classList.remove('loading');
  }
}

async function loadLightboxSvg(cardId) {
  loadLightboxPanel('lightbox-svg', '/api/pokeproxy/svg/' + cardId + '?t=' + Date.now());
}

async function loadLightboxPanel(elId, url) {
  const el = document.getElementById(elId);
  el.innerHTML = '<span class="placeholder">Loading SVG...</span>';
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    el.innerHTML = await resp.text();
  } catch (e) {
    el.textContent = 'Failed: ' + e.message;
  }
}

function showPreview(cardId) {
  const card = cardData[cardId];
  if (!card) return;
  currentCardId = cardId;

  document.getElementById('lightbox-title').textContent = card.label + ' — ' + card.name;
  document.getElementById('lightbox-src').src = '/api/pokeproxy/image/' + cardId + '/source';
  showCleanPanel(cardId);
  // Dynamic labels based on card type
  var isStandard = !card.isFullArt;
  document.querySelector('.btn-clean').textContent = isStandard ? 'Expand (ComfyUI)' : 'Clean (ComfyUI)';
  document.querySelector('.btn-force-clean').textContent = isStandard ? 'Re-expand' : 'Force Re-clean';
  var cleanLabel = document.querySelector('#lightbox-clean-panel .lightbox-panel-label');
  if (cleanLabel) cleanLabel.textContent = isStandard ? 'Expanded' : 'Cleaned';
  loadLightboxSvg(cardId);
  document.getElementById('lightbox-status').textContent = '';

  // Prompt editor
  const promptEl = document.getElementById('prompt-info');
  const currentPrompt = card.promptText || '';
  const ruleName = card.promptRule || 'none';

  let metaHtml = '';
  if (card.cleanMeta) {
    metaHtml = '<div class="prompt-meta">Last clean: rule=' + esc(card.cleanMeta.rule) +
      ', seed=' + card.cleanMeta.seed + ', ' + card.cleanMeta.timestamp + '</div>';
  }

  promptEl.innerHTML =
    '<div class="prompt-label">Prompt <span style="color:#888;font-weight:400">(rule: ' + esc(ruleName) + ')</span></div>' +
    '<textarea id="prompt-edit">' + esc(currentPrompt) + '</textarea>' +
    '<div class="prompt-actions">' +
      '<button class="btn-save-prompt" onclick="savePrompt()">Save for this card</button>' +
      '<span class="prompt-save-status" id="prompt-save-status"></span>' +
    '</div>' +
    metaHtml;

  document.getElementById('lightbox').classList.add('active');
}

function esc(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

async function savePrompt() {
  if (!currentCardId) return;
  const textarea = document.getElementById('prompt-edit');
  const prompt = textarea.value.trim();
  if (!prompt) return;

  const statusEl = document.getElementById('prompt-save-status');
  statusEl.textContent = 'Saving...';
  statusEl.style.color = '#aaa';

  try {
    const resp = await fetch('/gallery/prompt/' + currentCardId, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    const data = await resp.json();
    if (data.status === 'saved') {
      statusEl.textContent = 'Saved!';
      statusEl.style.color = '#9ae6b4';
      // Update local card data
      if (cardData[currentCardId]) {
        cardData[currentCardId].promptText = prompt;
        cardData[currentCardId].promptRule = 'card:' + currentCardId;
      }
    } else {
      statusEl.textContent = 'Error: ' + (data.error || 'unknown');
      statusEl.style.color = '#fc8181';
    }
  } catch (e) {
    statusEl.textContent = 'Error: ' + e.message;
    statusEl.style.color = '#fc8181';
  }
}

function showCleanPanel(cardId) {
  const panel = document.getElementById('lightbox-clean-panel');
  const img = document.getElementById('lightbox-clean');
  const card = cardData[cardId];
  if (card && (card.hasComposite || card.hasClean)) {
    const type = card.hasComposite ? 'composite' : 'clean';
    img.src = '/api/pokeproxy/image/' + cardId + '/' + type + '?t=' + Date.now();
    panel.style.display = '';
  } else {
    panel.style.display = 'none';
    img.src = '';
  }
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('active');
  currentCardId = null;
}

function setStatus(msg) {
  document.getElementById('lightbox-status').textContent = msg;
}

function setButtons(enabled) {
  document.querySelectorAll('.lightbox-actions button').forEach(b => b.disabled = !enabled);
}

async function doClean(force) {
  if (!currentCardId) return;
  const cardId = currentCardId;
  const card = cardData[cardId];
  const isStandard = card && !card.isFullArt;
  setButtons(false);
  setStatus(force
    ? (isStandard ? 'Re-expanding (random seed) via ComfyUI...' : 'Force re-cleaning (random seed) via ComfyUI...')
    : (isStandard ? 'Expanding via ComfyUI...' : 'Cleaning via ComfyUI...'));
  try {
    const url = '/api/pokeproxy/generate/' + cardId + (force ? '?force=true' : '');
    const resp = await fetch(url, { method: 'POST' });
    const data = await resp.json();
    if (data.status === 'generated' || data.status === 'already_exists') {
      const seedInfo = data.seed != null ? ' (seed ' + data.seed + ')' : '';
      const ruleInfo = data.rule ? ' [' + data.rule + ']' : '';
      setStatus((isStandard ? 'Expand' : 'Clean') + ' done' + seedInfo + ruleInfo + '. Regenerating SVG...');
      await doRegenInner(cardId);
      // Update badge
      const badges = document.getElementById('badges_' + cssId(cardId));
      var badgeClass = isStandard ? 'expanded' : 'clean';
      var badgeText = isStandard ? 'EXPANDED' : 'CLEANED';
      if (badges && !badges.querySelector('.badge.' + badgeClass)) {
        badges.insertAdjacentHTML('afterbegin', '<span class="badge ' + badgeClass + '">' + badgeText + '</span>');
      }
      // Show cleaned image panel
      if (cardData[cardId]) {
        cardData[cardId].hasComposite = true;
        cardData[cardId].hasClean = true;
      }
      showCleanPanel(cardId);
      // Update cached card data with clean metadata
      if (data.prompt && cardData[cardId]) {
        cardData[cardId].cleanMeta = {
          prompt: data.prompt,
          rule: data.rule,
          seed: data.seed,
          timestamp: new Date().toISOString(),
        };
        // Refresh prompt info display
        const promptEl = document.getElementById('prompt-info');
        if (promptEl && currentCardId === cardId) {
          showPreview(cardId);
        }
      }
    } else {
      setStatus((isStandard ? 'Expand' : 'Clean') + ' failed: ' + (data.error || data.status));
    }
  } catch (e) {
    setStatus('Error: ' + e.message + ' — is the server running?');
  }
  setButtons(true);
}

async function doRegen() {
  if (!currentCardId) return;
  setButtons(false);
  setStatus('Regenerating SVG...');
  try {
    await doRegenInner(currentCardId);
  } catch (e) {
    setStatus('Error: ' + e.message);
  }
  setButtons(true);
}

async function doRegenInner(cardId) {
  const resp = await fetch('/api/pokeproxy/svg/' + cardId + '/regenerate', { method: 'POST' });
  const data = await resp.json();
  if (data.status !== 'regenerated') {
    setStatus('Regen failed: ' + (data.error || data.status));
    return;
  }
  // Reload both lightbox panels and gallery thumbnail
  loadLightboxSvg(cardId);
  loadSvg(cardId);
  setStatus('Done — SVG updated');
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeLightbox();
});

// ── Mode switching with lazy init ──
let cardsInitialized = false;
let glyphsInitialized = false;

function setMode(mode) {
  const cardsView = document.getElementById('view-cards');
  const glyphsView = document.getElementById('view-glyphs');
  const subtitle = document.querySelector('.subtitle');
  document.querySelectorAll('.mode-tab').forEach(function(tab) {
    tab.classList.toggle('active', tab.dataset.mode === mode);
  });
  cardsView.style.display = mode === 'cards' ? '' : 'none';
  glyphsView.style.display = mode === 'glyphs' ? '' : 'none';
  if (location.hash !== '#' + mode) location.hash = mode;

  if (mode === 'cards') {
    if (!cardsInitialized) {
      cardsInitialized = true;
      subtitle.textContent = 'Loading cards...';
      init();
    }
  } else if (mode === 'glyphs') {
    subtitle.textContent = 'Energy color palettes';
    if (!glyphsInitialized) {
      glyphsInitialized = true;
      initPalettes();
    }
  }
}

window.addEventListener('hashchange', function() {
  setMode(location.hash === '#glyphs' ? 'glyphs' : 'cards');
});

setMode(location.hash === '#glyphs' ? 'glyphs' : 'cards');
</script>
</body>
</html>`;
}

export default app;

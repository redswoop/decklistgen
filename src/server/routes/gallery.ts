import { Hono } from "hono";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isFullArt } from "../../shared/utils/detect-fullart.js";
import { getPromptForCard, saveCardPrompt } from "../services/prompt-db.js";
import { getCard, loadSet, isSetLoaded } from "../services/card-store.js";
import { REVERSE_SET_MAP } from "../../shared/constants/set-codes.js";
import type { TcgdexCard } from "../../shared/types/card.js";
import { renderEnergyPreviewSvg } from "../services/pokeproxy/energy-preview.js";

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
  .energy-preview-section {
    margin: 0 auto 24px;
    max-width: 900px;
  }
  .energy-preview-section h2 {
    font-size: 14px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #888;
    margin-bottom: 8px;
  }
  .energy-preview-section img {
    width: 100%;
    display: block;
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
  .lightbox-status {
    font-size: 13px;
    color: #aaa;
    text-align: center;
  }
</style>
</head>
<body>
  <h1>Pokeproxy Gallery</h1>
  <div class="subtitle">Loading cards...</div>
  <div class="energy-preview-section">
    <h2>Energy Glyphs</h2>
    ${renderEnergyPreviewSvg()}
  </div>
  <div class="gallery" id="gallery"></div>

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

function svgUrl(cardId) {
  return '/api/pokeproxy/svg/' + cardId + '?t=' + Date.now();
}

async function init() {
  const resp = await fetch('/gallery/cards');
  const cards = await resp.json();
  const subtitle = document.querySelector('.subtitle');
  subtitle.textContent = cards.length + ' test cards';

  const gallery = document.getElementById('gallery');
  for (const card of cards) {
    cardData[card.cardId] = card;
    const el = document.createElement('div');
    el.className = 'card loading';
    el.dataset.cardId = card.cardId;
    el.onclick = () => showPreview(card.cardId);

    const badges = [];
    if (card.hasClean) badges.push('<span class="badge clean">CLEANED</span>');
    badges.push('<span class="badge ' + (card.isFullArt ? 'fullart' : 'standard') + '">' +
      (card.isFullArt ? 'FULLART' : 'STANDARD') + '</span>');

    const meta = [card.category, card.stage, card.hp ? 'HP ' + card.hp : null,
      (card.energyTypes || []).join(', ') || null, card.rarity].filter(Boolean).join(' | ');

    el.innerHTML =
      '<div class="label">' + card.label + '</div>' +
      '<div class="card-name">' + card.name + '</div>' +
      '<div class="card-id">' + card.cardId + '</div>' +
      '<div class="badges" id="badges_' + cssId(card.cardId) + '">' + badges.join('') + '</div>' +
      '<div class="meta">' + meta + '</div>' +
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
    container.innerHTML = '<span class="placeholder">Failed: ' + e.message + '</span>';
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
    el.innerHTML = '<span class="placeholder">Failed: ' + e.message + '</span>';
  }
}

function showPreview(cardId) {
  const card = cardData[cardId];
  if (!card) return;
  currentCardId = cardId;

  document.getElementById('lightbox-title').textContent = card.label + ' — ' + card.name;
  document.getElementById('lightbox-src').src = '/api/pokeproxy/image/' + cardId + '/source';
  showCleanPanel(cardId);
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
  setButtons(false);
  setStatus(force ? 'Force re-cleaning (random seed) via ComfyUI...' : 'Cleaning via ComfyUI...');
  try {
    const url = '/api/pokeproxy/generate/' + cardId + (force ? '?force=true' : '');
    const resp = await fetch(url, { method: 'POST' });
    const data = await resp.json();
    if (data.status === 'generated' || data.status === 'already_exists') {
      const seedInfo = data.seed != null ? ' (seed ' + data.seed + ')' : '';
      const ruleInfo = data.rule ? ' [' + data.rule + ']' : '';
      setStatus('Clean done' + seedInfo + ruleInfo + '. Regenerating SVG...');
      await doRegenInner(cardId);
      // Update badge
      const badges = document.getElementById('badges_' + cssId(cardId));
      if (badges && !badges.querySelector('.badge.clean')) {
        badges.insertAdjacentHTML('afterbegin', '<span class="badge clean">CLEANED</span>');
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
      setStatus('Clean failed: ' + (data.error || data.status));
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

init();
</script>
</body>
</html>`;
}

export default app;

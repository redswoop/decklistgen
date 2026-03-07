import { Hono } from "hono";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { isFullArt } from "../../shared/utils/detect-fullart.js";
import type { TcgdexCard } from "../../shared/types/card.js";

const CACHE_DIR = join(import.meta.dir, "../../../cache");

/** Load card data from cached JSON file */
function loadCachedCard(cardId: string): Record<string, unknown> | null {
  const jsonPath = join(CACHE_DIR, `${cardId}.json`);
  if (!existsSync(jsonPath)) return null;
  try {
    const text = require("node:fs").readFileSync(jsonPath, "utf-8");
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
app.get("/cards", (c) => {
  const cards = TEST_CARDS.map(({ label, cardId }) => {
    const card = loadCachedCard(cardId);
    const hasClean = existsSync(join(CACHE_DIR, `${cardId}_clean.png`));
    const hasComposite = existsSync(join(CACHE_DIR, `${cardId}_composite.png`));
    const hasSvg = existsSync(join(CACHE_DIR, `${cardId}.svg`));
    const hasSource = existsSync(join(CACHE_DIR, `${cardId}.png`));
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
    };
  });
  return c.json(cards);
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
    margin-bottom: 24px;
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
    justify-content: center;
    align-items: center;
    gap: 32px;
    padding: 40px;
  }
  .lightbox.active { display: flex; }
  .lightbox-panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  .lightbox-panel-label {
    font-size: 14px;
    font-weight: 700;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .lightbox-panel img,
  .lightbox-panel .lightbox-svg {
    height: 70vh;
    width: auto;
    border-radius: 12px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.5);
  }
  .lightbox-panel .lightbox-svg svg {
    height: 70vh;
    width: auto;
    display: block;
  }
  .lightbox-close {
    position: fixed;
    top: 16px;
    right: 24px;
    font-size: 32px;
    color: #888;
    cursor: pointer;
    z-index: 1001;
    line-height: 1;
  }
  .lightbox-close:hover { color: #fff; }
  .lightbox-title {
    position: fixed;
    top: 16px;
    left: 24px;
    font-size: 18px;
    font-weight: 700;
    color: #fff;
    z-index: 1001;
  }
  .lightbox-actions {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 12px;
    z-index: 1001;
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
    position: fixed;
    bottom: 72px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 13px;
    color: #aaa;
    z-index: 1001;
    text-align: center;
  }
</style>
</head>
<body>
  <h1>Pokeproxy Gallery</h1>
  <div class="subtitle">Loading cards...</div>
  <div class="gallery" id="gallery"></div>

  <div class="lightbox" id="lightbox" onclick="closeLightbox(event)">
    <div class="lightbox-close" onclick="closeLightbox()">&times;</div>
    <div class="lightbox-title" id="lightbox-title"></div>
    <div class="lightbox-panel">
      <div class="lightbox-panel-label">Source</div>
      <img id="lightbox-src" src="" />
    </div>
    <div class="lightbox-panel">
      <div class="lightbox-panel-label">Proxy</div>
      <div class="lightbox-svg" id="lightbox-svg"></div>
    </div>
    <div class="lightbox-status" id="lightbox-status"></div>
    <div class="lightbox-actions">
      <button class="btn-clean" onclick="doClean(false)">Clean (ComfyUI)</button>
      <button class="btn-force-clean" onclick="doClean(true)">Force Re-clean</button>
      <button class="btn-regen" onclick="doRegen()">Regen SVG</button>
    </div>
  </div>

<script>
let currentCardId = null;
let cardData = {};

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
  try {
    const resp = await fetch('/api/pokeproxy/svg/' + cardId + '?t=' + Date.now());
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    container.innerHTML = await resp.text();
    cardEl.classList.remove('loading');
  } catch (e) {
    container.innerHTML = '<span class="placeholder">Failed: ' + e.message + '</span>';
    cardEl.classList.remove('loading');
  }
}

function showPreview(cardId) {
  const card = cardData[cardId];
  if (!card) return;
  currentCardId = cardId;

  document.getElementById('lightbox-title').textContent = card.label + ' — ' + card.name;
  document.getElementById('lightbox-src').src = '/api/pokeproxy/image/' + cardId + '/source';
  document.getElementById('lightbox-svg').innerHTML =
    document.getElementById('svg_' + cssId(cardId)).innerHTML;
  document.getElementById('lightbox-status').textContent = '';
  document.getElementById('lightbox').classList.add('active');
}

function closeLightbox(e) {
  if (e && e.target !== e.currentTarget && !e.target.classList.contains('lightbox-close')) return;
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
      setStatus('Clean done' + seedInfo + '. Regenerating SVG...');
      await doRegenInner(cardId);
      // Update badge
      const badges = document.getElementById('badges_' + cssId(cardId));
      if (badges && !badges.querySelector('.badge.clean')) {
        badges.insertAdjacentHTML('afterbegin', '<span class="badge clean">CLEANED</span>');
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
  const svgResp = await fetch('/api/pokeproxy/svg/' + cardId + '?t=' + Date.now());
  if (!svgResp.ok) {
    setStatus('Failed to fetch new SVG');
    return;
  }
  const svgText = await svgResp.text();
  // Update lightbox
  document.getElementById('lightbox-svg').innerHTML = svgText;
  // Update gallery card
  const galleryContainer = document.getElementById('svg_' + cssId(cardId));
  if (galleryContainer) galleryContainer.innerHTML = svgText;
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

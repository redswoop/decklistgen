/**
 * Card Element Editor — interactive visual editor for tuning element positions,
 * sizes, and properties on card backgrounds.
 */

import { Hono } from "hono";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { CARD_W, CARD_H } from "../services/pokeproxy/constants.js";
import { createElement, createDefaultElements, renderElements } from "../services/pokeproxy/elements/index.js";
import { getFontStyle } from "../services/pokeproxy/type-icons.js";
import { splitNameSuffix } from "../services/pokeproxy/svg-helpers.js";
import type { ElementState } from "../services/pokeproxy/elements/index.js";

const CACHE_DIR = join(import.meta.dir, "../../..", "cache");

const editorRouter = new Hono();

/** Load the clean image for a card (used as editor background) */
async function loadCleanImageB64(cardId: string): Promise<string | null> {
  const p = join(CACHE_DIR, `${cardId}_clean.png`);
  if (existsSync(p)) {
    return (await readFile(p)).toString("base64");
  }
  return null;
}

/** Load the raw original card image */
async function loadRawImageB64(cardId: string): Promise<string | null> {
  const p = join(CACHE_DIR, `${cardId}.png`);
  if (existsSync(p)) {
    return (await readFile(p)).toString("base64");
  }
  return null;
}

/** Build minimal SVG: card background + elements */
function buildEditorSvg(imageB64: string, elementsHtml: string): string {
  const lines: string[] = [];
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${CARD_W} ${CARD_H}" width="${CARD_W}" height="${CARD_H}">`);
  lines.push("  <defs>");
  lines.push(`    <clipPath id="card-clip"><rect width="${CARD_W}" height="${CARD_H}" rx="25" ry="25"/></clipPath>`);
  lines.push('    <filter id="shadow"><feDropShadow dx="1" dy="1" stdDeviation="1.5" flood-opacity="0.7"/></filter>');
  lines.push('    <filter id="title-shadow"><feDropShadow dx="1.5" dy="2" stdDeviation="1.5" flood-opacity="0.8"/></filter>');
  lines.push('    <filter id="dmg-shadow"><feDropShadow dx="1" dy="1.5" stdDeviation="1" flood-opacity="0.8"/></filter>');
  lines.push("    " + getFontStyle());
  lines.push("  </defs>");
  lines.push('  <g clip-path="url(#card-clip)">');
  lines.push(`    <image x="0" y="0" width="${CARD_W}" height="${CARD_H}" preserveAspectRatio="xMidYMid slice" href="data:image/png;base64,${imageB64}"/>`);
  lines.push("  </g>");
  lines.push(elementsHtml);
  lines.push(`  <rect width="${CARD_W}" height="${CARD_H}" rx="25" ry="25" fill="none" stroke="#444" stroke-width="4"/>`);
  lines.push("</svg>");
  return lines.join("\n");
}

// GET /cards — list cards that have clean images
editorRouter.get("/cards", async (c) => {
  try {
    const files = await readdir(CACHE_DIR);
    const cardIds: string[] = [];
    for (const f of files) {
      const m = f.match(/^([a-zA-Z0-9._-]+?)_clean\.png$/);
      if (m) cardIds.push(m[1]);
    }
    cardIds.sort();
    return c.json(cardIds);
  } catch {
    return c.json([]);
  }
});

// GET /card-data?cardId=X — return cached card JSON
editorRouter.get("/card-data", async (c) => {
  const cardId = c.req.query("cardId");
  if (!cardId) return c.text("Missing cardId", 400);
  const jsonPath = join(CACHE_DIR, `${cardId}.json`);
  if (!existsSync(jsonPath)) return c.json(null);
  try {
    const data = JSON.parse(await readFile(jsonPath, "utf-8"));
    const name = (data.name as string) ?? "";
    const [baseName, nameSuffix] = splitNameSuffix(name, data);
    data._baseName = baseName;
    data._nameSuffix = nameSuffix;
    return c.json(data);
  } catch {
    return c.json(null);
  }
});

// GET /render?cardId=X&elements=[...]
editorRouter.get("/render", async (c) => {
  const cardId = c.req.query("cardId");
  if (!cardId) return c.text("Missing cardId", 400);

  const imageB64 = await loadCleanImageB64(cardId);
  if (!imageB64) return c.text("No clean image found for card", 404);

  let elements;
  const elementsParam = c.req.query("elements");
  if (elementsParam) {
    try {
      const states: ElementState[] = JSON.parse(elementsParam);
      elements = states.map(s => createElement(s));
    } catch {
      return c.text("Invalid elements JSON", 400);
    }
  } else {
    elements = createDefaultElements();
  }

  const elementsHtml = renderElements(elements);
  const svg = buildEditorSvg(imageB64, elementsHtml);
  return c.body(svg, 200, { "Content-Type": "image/svg+xml" });
});

// GET /raw-image?cardId=X — serve raw original card image
editorRouter.get("/raw-image", async (c) => {
  const cardId = c.req.query("cardId");
  if (!cardId) return c.text("Missing cardId", 400);
  const p = join(CACHE_DIR, `${cardId}.png`);
  if (!existsSync(p)) return c.text("No raw image found", 404);
  const buf = await readFile(p);
  return c.body(buf, 200, { "Content-Type": "image/png" });
});

// GET / — editor HTML page
editorRouter.get("/", (c) => {
  return c.html(editorHtml());
});

function editorHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Card Element Editor</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #1a1a2e; color: #e0e0e0; height: 100vh; display: flex; flex-direction: column; }
  .toolbar { padding: 8px 16px; background: #16213e; border-bottom: 1px solid #333; display: flex; align-items: center; gap: 12px; }
  .toolbar .spacer { flex: 1; }
  .toolbar .zoom-control { display: flex; align-items: center; gap: 6px; }
  .toolbar .zoom-control input[type="range"] { width: 120px; accent-color: #4a9eff; }
  .toolbar .zoom-control span { font-size: 11px; color: #888; min-width: 32px; text-align: right; }
  .toolbar label { font-size: 13px; color: #aaa; }
  .toolbar select { background: #0f3460; color: #e0e0e0; border: 1px solid #444; border-radius: 4px; padding: 4px 8px; font-size: 13px; }
  .main { flex: 1; display: flex; overflow: hidden; }
  .cards-area { flex: 1; overflow: hidden; background: #111; position: relative; cursor: grab; }
  .cards-area.panning { cursor: grabbing; }
  .cards-inner { display: flex; align-items: center; justify-content: center; gap: 24px; position: absolute; top: 50%; left: 50%; transform-origin: 0 0; }
  .ref-card { flex-shrink: 0; }
  .ref-card img { border-radius: 12px; border: 2px solid #333; }
  .canvas-wrap { flex-shrink: 0; display: flex; align-items: center; justify-content: center; position: relative; }
  .canvas-wrap svg { cursor: crosshair; }
  .sidebar { width: 280px; background: #16213e; border-left: 1px solid #333; overflow-y: auto; display: flex; flex-direction: column; }
  .sidebar h3 { font-size: 13px; text-transform: uppercase; color: #888; padding: 12px 12px 6px; letter-spacing: 1px; }
  .element-list { padding: 0 12px; }
  .element-item { padding: 6px 8px; border-radius: 4px; cursor: pointer; font-size: 13px; margin-bottom: 2px; border: 1px solid transparent; }
  .element-item:hover { background: #0f3460; }
  .element-item.selected { background: #0f3460; border-color: #4a9eff; }
  .element-item.child { padding-left: 24px; font-size: 12px; color: #aaa; }
  .element-item.child:hover { color: #e0e0e0; }
  .element-item.child.selected { color: #e0e0e0; }
  .props-panel { padding: 12px; flex: 1; }
  .prop-row { margin-bottom: 10px; }
  .prop-row label { display: block; font-size: 11px; color: #888; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.5px; }
  .prop-row input[type="number"] { width: 80px; background: #0f3460; color: #e0e0e0; border: 1px solid #444; border-radius: 3px; padding: 3px 6px; font-size: 13px; }
  .prop-row input[type="text"] { width: 100%; background: #0f3460; color: #e0e0e0; border: 1px solid #444; border-radius: 3px; padding: 3px 6px; font-size: 13px; }
  .prop-row input[type="range"] { width: 100%; accent-color: #4a9eff; }
  .prop-row input[type="color"] { width: 100%; height: 28px; padding: 1px; border: 1px solid #444; border-radius: 3px; background: #0f3460; cursor: pointer; }
  .prop-row select { width: 100%; background: #0f3460; color: #e0e0e0; border: 1px solid #444; border-radius: 3px; padding: 3px 6px; font-size: 13px; }
  .prop-row .range-val { font-size: 11px; color: #aaa; float: right; }
  .section-label { font-size: 11px; color: #4a9eff; text-transform: uppercase; letter-spacing: 0.5px; margin: 10px 0 6px; border-bottom: 1px solid #333; padding-bottom: 4px; }
  .add-child-bar { display: flex; gap: 6px; margin-top: 4px; }
  .add-child-bar button, .remove-btn { background: #0f3460; color: #e0e0e0; border: 1px solid #444; border-radius: 3px; padding: 4px 10px; font-size: 11px; cursor: pointer; }
  .add-child-bar button:hover, .remove-btn:hover { background: #1a5276; }
  .remove-btn { background: #3a1a1a; border-color: #744; color: #e88; margin-top: 10px; }
  .remove-btn:hover { background: #5a2a2a; }
  .bottom-bar { padding: 8px 16px; background: #16213e; border-top: 1px solid #333; display: flex; align-items: center; gap: 8px; }
  .bottom-bar button { background: #0f3460; color: #e0e0e0; border: 1px solid #444; border-radius: 4px; padding: 5px 12px; font-size: 12px; cursor: pointer; }
  .bottom-bar button:hover { background: #1a5276; }
  .bottom-bar .status { flex: 1; text-align: right; font-size: 11px; color: #666; }
  .selection-rect { fill: none; stroke: #4a9eff; stroke-width: 2; stroke-dasharray: 6 3; pointer-events: none; }
  .no-selection { padding: 12px; font-size: 12px; color: #666; font-style: italic; }
  .key-hint { font-size: 10px; color: #555; margin-top: 8px; line-height: 1.5; }
</style>
</head>
<body>
<div class="toolbar">
  <label>Card:</label>
  <select id="card-picker"><option value="">Loading...</option></select>
  <div class="spacer"></div>
  <div class="zoom-control">
    <label>Zoom</label>
    <input type="range" id="zoom-slider" min="20" max="200" step="5" value="55">
    <span id="zoom-label">55%</span>
    <button id="btn-fit" style="background:#0f3460;color:#e0e0e0;border:1px solid #444;border-radius:3px;padding:3px 8px;font-size:11px;cursor:pointer;">Fit</button>
  </div>
</div>
<div class="main">
  <div class="cards-area" id="cards-area">
    <div class="cards-inner" id="cards-inner">
      <div class="ref-card" id="ref-card"></div>
      <div class="canvas-wrap" id="canvas-wrap"></div>
    </div>
  </div>
  <div class="sidebar">
    <h3>Elements</h3>
    <div class="element-list" id="element-list"></div>
    <h3>Properties</h3>
    <div class="props-panel" id="props-panel">
      <div class="no-selection">Click an element to select it</div>
    </div>
  </div>
</div>
<div class="bottom-bar">
  <button id="btn-copy-json">Copy JSON</button>
  <button id="btn-copy-code">Copy Code</button>
  <div class="status" id="status">Ready</div>
</div>

<script>
(function() {
  var BASE = '/gallery/editor';
  var elements = null;
  var selectedElementId = null;
  var selectedChildIndex = null; // null = element selected, number = child
  var serverPos = {};
  var debounceTimer = null;
  var cardData = null;
  var zoomLevel = 0.55;
  var panX = 0, panY = 0;
  var isPanning = false, panStartX = 0, panStartY = 0, panStartPanX = 0, panStartPanY = 0;

  // ── Zoom + Pan ──
  function applyTransform() {
    var inner = document.getElementById('cards-inner');
    // Offset so the content center sits at the area center, then apply pan
    var hw = inner.scrollWidth / 2;
    var hh = inner.scrollHeight / 2;
    var tx = panX - hw * zoomLevel;
    var ty = panY - hh * zoomLevel;
    inner.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + zoomLevel + ')';
    var pct = Math.round(zoomLevel * 100);
    document.getElementById('zoom-label').textContent = pct + '%';
    document.getElementById('zoom-slider').value = pct;
  }

  function zoomToFit() {
    var area = document.getElementById('cards-area');
    var inner = document.getElementById('cards-inner');
    // Temporarily reset to measure natural size
    inner.style.transform = 'none';
    var iw = inner.scrollWidth;
    var ih = inner.scrollHeight;
    inner.style.transform = '';
    var aw = area.clientWidth;
    var ah = area.clientHeight;
    if (iw > 0 && ih > 0) {
      zoomLevel = Math.min(aw / iw, ah / ih) * 0.95;
      zoomLevel = Math.min(2, Math.max(0.2, zoomLevel));
    }
    panX = 0;
    panY = 0;
    applyTransform();
  }

  // ── Client-side prop definitions ──
  var PROP_DEFS = {
    'big-logo': [
      { key: 'x', label: 'X', type: 'number', min: -200, max: 750, step: 1, isPosition: true },
      { key: 'y', label: 'Y', type: 'number', min: -200, max: 1050, step: 1, isPosition: true },
      { key: 'height', label: 'Height', type: 'range', min: 50, max: 600, step: 10 },
      { key: 'opacity', label: 'Opacity', type: 'range', min: 0, max: 1, step: 0.05 },
      { key: 'suffix', label: 'Logo', type: 'select', options: ['V', 'ex', 'VSTAR', 'VSTAR-big'] },
    ],
    'packed-row': [
      { key: 'anchorX', label: 'Anchor X', type: 'number', min: -200, max: 900, step: 1, isPosition: true },
      { key: 'anchorY', label: 'Anchor Y', type: 'number', min: -200, max: 1100, step: 1, isPosition: true },
      { key: 'direction', label: 'Direction', type: 'select', options: ['ltr', 'rtl'] },
      { key: 'width', label: 'Width', type: 'number', min: 0, max: 900, step: 1 },
      { key: 'fill', label: 'Fill', type: 'color' },
      { key: 'fillOpacity', label: 'Fill Opacity', type: 'range', min: 0, max: 1, step: 0.05 },
      { key: 'rx', label: 'Corner Radius', type: 'number', min: 0, max: 30, step: 1 },
    ],
  };

  var ENERGY_TYPES = ['Grass','Fire','Water','Lightning','Psychic','Fighting','Darkness','Metal','Fairy','Dragon','Colorless'];

  var SUB_PROP_DEFS = {
    'text': [
      { key: 'text', label: 'Text', type: 'text' },
      { key: 'fontSize', label: 'Font Size', type: 'number', min: 8, max: 120, step: 1 },
      { key: 'fontFamily', label: 'Font', type: 'select', options: ['title', 'body'] },
      { key: 'fontWeight', label: 'Weight', type: 'select', options: ['normal', 'bold'] },
      { key: 'fill', label: 'Fill', type: 'color' },
      { key: 'opacity', label: 'Opacity', type: 'range', min: 0, max: 1, step: 0.05 },
      { key: 'stroke', label: 'Stroke', type: 'color' },
      { key: 'strokeWidth', label: 'Stroke W', type: 'number', min: 0, max: 10, step: 0.5 },
      { key: 'filter', label: 'Filter', type: 'select', options: ['none', 'shadow', 'title-shadow', 'dmg-shadow'] },
      { key: 'textAnchor', label: 'Anchor', type: 'select', options: ['start', 'middle', 'end'] },
      { key: 'grow', label: 'Grow', type: 'number', min: 0, max: 10, step: 1 },
      { key: 'hAlign', label: 'H-Align', type: 'select', options: ['start', 'center', 'end'] },
      { key: 'marginTop', label: 'Margin Top', type: 'number', min: -50, max: 50, step: 1 },
      { key: 'marginRight', label: 'Margin Right', type: 'number', min: -50, max: 50, step: 1 },
      { key: 'marginBottom', label: 'Margin Bottom', type: 'number', min: -50, max: 50, step: 1 },
      { key: 'marginLeft', label: 'Margin Left', type: 'number', min: -50, max: 50, step: 1 },
      { key: 'paddingTop', label: 'Pad Top', type: 'number', min: 0, max: 50, step: 1 },
      { key: 'paddingRight', label: 'Pad Right', type: 'number', min: 0, max: 50, step: 1 },
      { key: 'paddingBottom', label: 'Pad Bottom', type: 'number', min: 0, max: 50, step: 1 },
      { key: 'paddingLeft', label: 'Pad Left', type: 'number', min: 0, max: 50, step: 1 },
      { key: 'vAlign', label: 'V-Align', type: 'select', options: ['top', 'middle', 'bottom'] },
    ],
    'type-dot': [
      { key: 'energyType', label: 'Type', type: 'select', options: ENERGY_TYPES },
      { key: 'radius', label: 'Radius', type: 'number', min: 5, max: 60, step: 1 },
      { key: 'grow', label: 'Grow', type: 'number', min: 0, max: 10, step: 1 },
      { key: 'hAlign', label: 'H-Align', type: 'select', options: ['start', 'center', 'end'] },
      { key: 'marginTop', label: 'Margin Top', type: 'number', min: -50, max: 50, step: 1 },
      { key: 'marginRight', label: 'Margin Right', type: 'number', min: -50, max: 50, step: 1 },
      { key: 'marginBottom', label: 'Margin Bottom', type: 'number', min: -50, max: 50, step: 1 },
      { key: 'marginLeft', label: 'Margin Left', type: 'number', min: -50, max: 50, step: 1 },
      { key: 'paddingTop', label: 'Pad Top', type: 'number', min: 0, max: 50, step: 1 },
      { key: 'paddingRight', label: 'Pad Right', type: 'number', min: 0, max: 50, step: 1 },
      { key: 'paddingBottom', label: 'Pad Bottom', type: 'number', min: 0, max: 50, step: 1 },
      { key: 'paddingLeft', label: 'Pad Left', type: 'number', min: 0, max: 50, step: 1 },
      { key: 'vAlign', label: 'V-Align', type: 'select', options: ['top', 'middle', 'bottom'] },
    ],
    'suffix-logo': [
      { key: 'suffix', label: 'Suffix', type: 'select', options: ['V', 'ex', 'VSTAR'] },
      { key: 'height', label: 'Height', type: 'number', min: 10, max: 120, step: 1 },
      { key: 'filter', label: 'Filter', type: 'select', options: ['none', 'shadow', 'title-shadow'] },
      { key: 'grow', label: 'Grow', type: 'number', min: 0, max: 10, step: 1 },
      { key: 'hAlign', label: 'H-Align', type: 'select', options: ['start', 'center', 'end'] },
      { key: 'marginTop', label: 'Margin Top', type: 'number', min: -50, max: 50, step: 1 },
      { key: 'marginRight', label: 'Margin Right', type: 'number', min: -50, max: 50, step: 1 },
      { key: 'marginBottom', label: 'Margin Bottom', type: 'number', min: -50, max: 50, step: 1 },
      { key: 'marginLeft', label: 'Margin Left', type: 'number', min: -50, max: 50, step: 1 },
      { key: 'paddingTop', label: 'Pad Top', type: 'number', min: 0, max: 50, step: 1 },
      { key: 'paddingRight', label: 'Pad Right', type: 'number', min: 0, max: 50, step: 1 },
      { key: 'paddingBottom', label: 'Pad Bottom', type: 'number', min: 0, max: 50, step: 1 },
      { key: 'paddingLeft', label: 'Pad Left', type: 'number', min: 0, max: 50, step: 1 },
      { key: 'vAlign', label: 'V-Align', type: 'select', options: ['top', 'middle', 'bottom'] },
    ],
  };

  // ── Helpers ──
  function normalizeHex(v) {
    var s = String(v || '#000000');
    if (/^#[0-9a-fA-F]{3}$/.test(s)) {
      return '#' + s[1]+s[1] + s[2]+s[2] + s[3]+s[3];
    }
    return s;
  }

  function getChildLabel(child) {
    if (child.type === 'text') {
      var t = String(child.props.text || '');
      if (t.length > 12) t = t.substring(0, 12) + '...';
      return '"' + t + '" text';
    }
    if (child.type === 'type-dot') {
      return String(child.props.energyType || '?') + ' dot';
    }
    if (child.type === 'suffix-logo') {
      return String(child.props.suffix || '?') + ' logo';
    }
    return child.type;
  }

  function getTransformOffset(el) {
    var t = el.getAttribute('transform') || '';
    var i = t.indexOf('translate(');
    if (i < 0) return { x: 0, y: 0 };
    var inner = t.substring(i + 10, t.indexOf(')', i));
    var parts = inner.split(',');
    if (parts.length < 2) parts = inner.split(' ');
    if (parts.length >= 2) return { x: parseFloat(parts[0]), y: parseFloat(parts[1]) };
    return { x: 0, y: 0 };
  }

  // ── Init ──
  async function init() {
    var resp = await fetch(BASE + '/cards');
    var cards = await resp.json();
    var picker = document.getElementById('card-picker');
    picker.innerHTML = '<option value="">-- pick a card --</option>';
    for (var i = 0; i < cards.length; i++) {
      var opt = document.createElement('option');
      opt.value = cards[i];
      opt.textContent = cards[i];
      picker.appendChild(opt);
    }
    picker.addEventListener('change', function() {
      if (picker.value) onCardPicked(picker.value);
    });

    // Restore card from URL hash
    var hashCard = location.hash.replace('#', '');
    if (hashCard && cards.indexOf(hashCard) >= 0) {
      picker.value = hashCard;
      onCardPicked(hashCard);
    }

    elements = [
      {
        type: 'big-logo', id: 'big-logo-1',
        props: { x: -50, y: -38, height: 280, opacity: 0.7, suffix: 'VSTAR-big' }
      },
      {
        type: 'packed-row', id: 'hp-cluster-1',
        props: { anchorX: 538, anchorY: 25, direction: 'ltr' },
        children: [
          { type: 'text', props: { text: 'HP', fontSize: 18, fontFamily: 'title', fontWeight: 'bold', fill: '#000000', opacity: 1, stroke: '', strokeWidth: 0, filter: 'none', textAnchor: 'start', marginTop: 0, marginRight: 4, marginBottom: 4, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: 'bottom' }, bind: {} },
          { type: 'text', props: { text: '130', fontSize: 50, fontFamily: 'title', fontWeight: 'bold', fill: '#000000', opacity: 1, stroke: '', strokeWidth: 0, filter: 'none', textAnchor: 'start', marginTop: 0, marginRight: 6, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: 'bottom' }, bind: { text: 'hp' } },
          { type: 'type-dot', props: { energyType: 'Fire', radius: 28, marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: 'middle' }, bind: { energyType: 'types[0]' } },
        ]
      },
      {
        type: 'packed-row', id: 'name-cluster-1',
        props: { anchorX: 30, anchorY: 62, direction: 'ltr' },
        children: [
          { type: 'text', props: { text: 'Leafeon', fontSize: 48, fontFamily: 'title', fontWeight: 'bold', fill: '#ffffff', opacity: 1, stroke: '#000000', strokeWidth: 2.5, filter: 'title-shadow', textAnchor: 'start', marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: 'bottom' }, bind: { text: '_baseName' } },
          { type: 'suffix-logo', props: { suffix: 'VSTAR', height: 55, filter: 'title-shadow', marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 4, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: 'bottom' }, bind: { suffix: '_nameSuffix' } },
        ]
      },
      {
        type: 'packed-row', id: 'attack-1',
        props: { anchorX: 20, anchorY: 530, direction: 'ltr', width: 710, fill: '#333333', fillOpacity: 0.1, rx: 5 },
        children: [
          { type: 'type-dot', props: { energyType: 'Grass', radius: 14, grow: 0, hAlign: 'start', marginTop: 0, marginRight: 4, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: 'middle' }, bind: { energyType: 'attacks[0].cost[0]' } },
          { type: 'type-dot', props: { energyType: 'Colorless', radius: 14, grow: 0, hAlign: 'start', marginTop: 0, marginRight: 6, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: 'middle' }, bind: { energyType: 'attacks[0].cost[1]' } },
          { type: 'text', props: { text: 'Leaf Blade', fontSize: 28, fontFamily: 'title', fontWeight: 'bold', fill: '#222222', opacity: 1, stroke: '', strokeWidth: 0, filter: 'shadow', textAnchor: 'start', grow: 1, hAlign: 'start', marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: 'middle' }, bind: { text: 'attacks[0].name' } },
          { type: 'text', props: { text: '60', fontSize: 36, fontFamily: 'title', fontWeight: 'bold', fill: '#cc0000', opacity: 1, stroke: '', strokeWidth: 0, filter: 'shadow', textAnchor: 'start', grow: 0, hAlign: 'end', marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: 'middle' }, bind: { text: 'attacks[0].damage' } },
        ]
      }
    ];
    renderElementList();

    document.getElementById('btn-copy-json').addEventListener('click', copyJson);
    document.getElementById('btn-copy-code').addEventListener('click', copyCode);
    document.addEventListener('keydown', onKeyDown);

    // Zoom with scroll wheel over cards area
    var cardsArea = document.getElementById('cards-area');
    cardsArea.addEventListener('wheel', function(e) {
      e.preventDefault();
      var delta = e.deltaY > 0 ? -0.02 : 0.02;
      zoomLevel = Math.min(2, Math.max(0.2, zoomLevel + delta));
      applyTransform();
    }, { passive: false });

    // Pan with click-drag on cards area
    cardsArea.addEventListener('mousedown', function(e) {
      // Only pan on direct clicks on the cards area background, or middle button anywhere
      if (e.button === 1 || (e.button === 0 && (e.target === cardsArea || e.target.id === 'cards-inner' || e.target.id === 'ref-card'))) {
        e.preventDefault();
        isPanning = true;
        panStartX = e.clientX;
        panStartY = e.clientY;
        panStartPanX = panX;
        panStartPanY = panY;
        cardsArea.classList.add('panning');
      }
    });
    window.addEventListener('mousemove', function(e) {
      if (!isPanning) return;
      panX = panStartPanX + (e.clientX - panStartX);
      panY = panStartPanY + (e.clientY - panStartY);
      applyTransform();
    });
    window.addEventListener('mouseup', function() {
      if (isPanning) {
        isPanning = false;
        cardsArea.classList.remove('panning');
      }
    });

    // Zoom slider
    var zoomSlider = document.getElementById('zoom-slider');
    zoomSlider.addEventListener('input', function() {
      zoomLevel = parseInt(zoomSlider.value) / 100;
      applyTransform();
    });

    // Zoom to fit
    document.getElementById('btn-fit').addEventListener('click', zoomToFit);

    zoomToFit();
  }

  // ── Card pick + data binding ──
  async function onCardPicked(cardId) {
    location.hash = cardId;

    // Load reference raw image
    var refEl = document.getElementById('ref-card');
    refEl.innerHTML = '<img src="' + BASE + '/raw-image?cardId=' + encodeURIComponent(cardId) + '" alt="Reference">';

    try {
      var resp = await fetch(BASE + '/card-data?cardId=' + encodeURIComponent(cardId));
      if (resp.ok) {
        cardData = await resp.json();
        if (cardData) applyBindings();
      }
    } catch(ex) { /* ignore */ }
    loadCard(cardId);
  }

  function resolveBinding(path, data) {
    if (!data || !path) return undefined;
    var parts = path.replace(/\\[/g, '.').replace(/\\]/g, '').split('.');
    var val = data;
    for (var i = 0; i < parts.length; i++) {
      if (val == null) return undefined;
      val = val[parts[i]];
    }
    return val;
  }

  function applyBindings() {
    if (!cardData || !elements) return;
    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      if (!el.children) continue;
      for (var ci = 0; ci < el.children.length; ci++) {
        var child = el.children[ci];
        if (!child.bind) continue;
        var keys = Object.keys(child.bind);
        for (var ki = 0; ki < keys.length; ki++) {
          var propKey = keys[ki];
          var val = resolveBinding(child.bind[propKey], cardData);
          if (val !== undefined) {
            child.props[propKey] = val;
          }
        }
      }
    }
  }

  // ── Load card ──
  async function loadCard(cardId) {
    setStatus('Loading...');
    var url = BASE + '/render?cardId=' + encodeURIComponent(cardId) +
      '&elements=' + encodeURIComponent(JSON.stringify(elements));
    var resp = await fetch(url);
    if (!resp.ok) { setStatus('Error: ' + resp.statusText); return; }
    var svg = await resp.text();
    var wrap = document.getElementById('canvas-wrap');
    wrap.innerHTML = svg;

    // Record server positions using isPosition propDefs
    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      var defs = PROP_DEFS[el.type];
      if (!defs) continue;
      var posKeys = defs.filter(function(d) { return d.isPosition; });
      if (posKeys.length >= 2) {
        serverPos[el.id] = {
          xKey: posKeys[0].key, yKey: posKeys[1].key,
          x: Number(el.props[posKeys[0].key]),
          y: Number(el.props[posKeys[1].key])
        };
      }
    }

    var svgEl = wrap.querySelector('svg');
    svgEl.addEventListener('click', onCanvasClick);
    setStatus('Ready');
    if (selectedElementId) showSelection();
  }

  function rerender() {
    var picker = document.getElementById('card-picker');
    if (picker.value) loadCard(picker.value);
  }

  function debouncedRerender() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(rerender, 300);
  }

  // ── Canvas click ──
  function onCanvasClick(e) {
    var node = e.target;
    var childIdx = null;
    while (node && node.tagName !== 'svg') {
      if (node.dataset && node.dataset.childIndex != null && childIdx == null) {
        childIdx = parseInt(node.dataset.childIndex);
      }
      if (node.dataset && node.dataset.elementId) {
        selectItem(node.dataset.elementId, childIdx);
        return;
      }
      node = node.parentElement;
    }
    selectItem(null, null);
  }

  function selectItem(elementId, childIndex) {
    selectedElementId = elementId;
    selectedChildIndex = (childIndex != null) ? childIndex : null;
    renderElementList();
    renderPropsPanel();
    showSelection();
  }

  // ── Selection highlight (accounts for transforms) ──
  function showSelection() {
    var wrap = document.getElementById('canvas-wrap');
    var svgEl = wrap.querySelector('svg');
    if (!svgEl) return;
    var old = svgEl.querySelector('.selection-rect');
    if (old) old.remove();
    if (!selectedElementId) return;
    var parentG = svgEl.querySelector('[data-element-id="' + selectedElementId + '"]');
    if (!parentG) return;

    // Determine which element to measure: child or parent
    var target = parentG;
    if (selectedChildIndex != null) {
      var childG = parentG.querySelector('[data-child-index="' + selectedChildIndex + '"]');
      if (childG) target = childG;
    }

    try {
      var bbox = target.getBBox();
      if (bbox.width === 0 && bbox.height === 0) return;
      // Walk up from target to SVG, accumulating translate offsets
      var tx = 0, ty = 0;
      var node = target;
      while (node && node !== svgEl) {
        var off = getTransformOffset(node);
        tx += off.x;
        ty += off.y;
        node = node.parentElement;
      }
      var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', bbox.x + tx - 3);
      rect.setAttribute('y', bbox.y + ty - 3);
      rect.setAttribute('width', bbox.width + 6);
      rect.setAttribute('height', bbox.height + 6);
      rect.classList.add('selection-rect');
      svgEl.appendChild(rect);
    } catch(ex) { /* empty group */ }
  }

  // ── Arrow keys ──
  function onKeyDown(e) {
    if (!selectedElementId) return;
    if (!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    var step = e.shiftKey ? 10 : 1;
    var el = elements.find(function(el) { return el.id === selectedElementId; });
    if (!el) return;

    // ── Child selected ──
    if (selectedChildIndex != null && el.children) {
      var ci = selectedChildIndex;
      var child = el.children[ci];
      if (!child) return;

      // Ctrl/Cmd + Left/Right: reorder child in array
      if (e.ctrlKey || e.metaKey) {
        var newIdx = ci;
        if (e.key === 'ArrowLeft' && ci > 0) newIdx = ci - 1;
        if (e.key === 'ArrowRight' && ci < el.children.length - 1) newIdx = ci + 1;
        if (newIdx !== ci) {
          var tmp = el.children[ci];
          el.children[ci] = el.children[newIdx];
          el.children[newIdx] = tmp;
          selectedChildIndex = newIdx;
          rerender();
          renderElementList();
          renderPropsPanel();
        }
        return;
      }

      // Plain arrows: nudge child via margin
      if (e.key === 'ArrowRight') child.props.marginLeft = Number(child.props.marginLeft || 0) + step;
      if (e.key === 'ArrowLeft')  child.props.marginLeft = Number(child.props.marginLeft || 0) - step;
      if (e.key === 'ArrowDown')  child.props.marginTop = Number(child.props.marginTop || 0) + step;
      if (e.key === 'ArrowUp')    child.props.marginTop = Number(child.props.marginTop || 0) - step;
      renderPropsPanel();
      debouncedRerender();
      return;
    }

    // ── Element selected: move position ──
    var defs = PROP_DEFS[el.type];
    if (!defs) return;
    var posKeys = defs.filter(function(d) { return d.isPosition; });
    if (posKeys.length < 2) return;
    var xKey = posKeys[0].key;
    var yKey = posKeys[1].key;

    if (e.key === 'ArrowLeft')  el.props[xKey] = Number(el.props[xKey]) - step;
    if (e.key === 'ArrowRight') el.props[xKey] = Number(el.props[xKey]) + step;
    if (e.key === 'ArrowUp')    el.props[yKey] = Number(el.props[yKey]) - step;
    if (e.key === 'ArrowDown')  el.props[yKey] = Number(el.props[yKey]) + step;

    // Instant DOM update via translate
    var sp = serverPos[el.id];
    if (sp) {
      var wrap = document.getElementById('canvas-wrap');
      var svgEl = wrap.querySelector('svg');
      if (svgEl) {
        var g = svgEl.querySelector('[data-element-id="' + selectedElementId + '"]');
        if (g) {
          if (el.type === 'packed-row') {
            g.setAttribute('transform', 'translate(' + Number(el.props[xKey]) + ',' + Number(el.props[yKey]) + ')');
          } else {
            var dx = Number(el.props[xKey]) - sp.x;
            var dy = Number(el.props[yKey]) - sp.y;
            g.setAttribute('transform', 'translate(' + dx + ',' + dy + ')');
          }
        }
        showSelection();
      }
    }

    renderPropsPanel();
    debouncedRerender();
  }

  // ── Element list (hierarchical) ──
  function renderElementList() {
    var list = document.getElementById('element-list');
    if (!elements) { list.innerHTML = ''; return; }
    var html = '';
    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      var isElSelected = (el.id === selectedElementId && selectedChildIndex == null);
      var cls = 'element-item' + (isElSelected ? ' selected' : '');
      html += '<div class="' + cls + '" data-id="' + el.id + '">' + el.id + '</div>';

      if (el.children) {
        for (var ci = 0; ci < el.children.length; ci++) {
          var isChildSelected = (el.id === selectedElementId && selectedChildIndex === ci);
          var childCls = 'element-item child' + (isChildSelected ? ' selected' : '');
          html += '<div class="' + childCls + '" data-id="' + el.id + '" data-child="' + ci + '">'
            + getChildLabel(el.children[ci]) + '</div>';
        }
      }
    }
    list.innerHTML = html;
    list.querySelectorAll('.element-item').forEach(function(item) {
      item.addEventListener('click', function() {
        var childIdx = (item.dataset.child != null) ? parseInt(item.dataset.child) : null;
        selectItem(item.dataset.id, childIdx);
      });
    });
  }

  // ── Render a single prop row ──
  function renderPropHtml(def, val) {
    var html = '<div class="prop-row">';
    html += '<label>' + def.label + '</label>';
    if (def.type === 'number') {
      html += '<input type="number" data-key="' + def.key + '" value="' + val + '"'
        + (def.min != null ? ' min="' + def.min + '"' : '')
        + (def.max != null ? ' max="' + def.max + '"' : '')
        + (def.step != null ? ' step="' + def.step + '"' : '')
        + ' data-position="' + (def.isPosition ? '1' : '0') + '">';
    } else if (def.type === 'range') {
      html += '<span class="range-val">' + val + '</span>';
      html += '<input type="range" data-key="' + def.key + '" value="' + val + '"'
        + ' min="' + (def.min || 0) + '" max="' + (def.max || 1) + '" step="' + (def.step || 0.01) + '">';
    } else if (def.type === 'select') {
      html += '<select data-key="' + def.key + '">';
      for (var i = 0; i < (def.options || []).length; i++) {
        var opt = def.options[i];
        html += '<option value="' + opt + '"' + (String(opt) === String(val) ? ' selected' : '') + '>' + opt + '</option>';
      }
      html += '</select>';
    } else if (def.type === 'text') {
      html += '<input type="text" data-key="' + def.key + '" value="' + (val != null ? val : '') + '">';
    } else if (def.type === 'color') {
      html += '<input type="color" data-key="' + def.key + '" value="' + normalizeHex(val) + '">';
    }
    html += '</div>';
    return html;
  }

  // ── Props panel ──
  function renderPropsPanel() {
    var panel = document.getElementById('props-panel');
    if (!selectedElementId) {
      panel.innerHTML = '<div class="no-selection">Click an element to select it</div>';
      return;
    }
    var el = elements.find(function(e) { return e.id === selectedElementId; });
    if (!el) { panel.innerHTML = ''; return; }

    var html = '';

    // ── Child selected: show child props only ──
    if (selectedChildIndex != null && el.children) {
      var child = el.children[selectedChildIndex];
      if (!child) { panel.innerHTML = ''; return; }

      var subDefs = SUB_PROP_DEFS[child.type] || [];
      html += '<div class="section-label">' + child.type + ' #' + selectedChildIndex + '</div>';
      for (var i = 0; i < subDefs.length; i++) {
        html += renderPropHtml(subDefs[i], child.props[subDefs[i].key]);
      }
      html += '<button class="remove-btn" id="remove-child-btn">Remove Child</button>';
      html += '<div class="key-hint">';
      html += 'Arrows: nudge margin<br>';
      html += 'Shift+Arrow: nudge x10<br>';
      html += 'Ctrl+Left/Right: reorder';
      html += '</div>';

      panel.innerHTML = html;

      // Attach child prop handlers
      panel.querySelectorAll('.prop-row input, .prop-row select').forEach(function(input) {
        var key = input.dataset.key;
        var handler = function() {
          var v = input.value;
          if (input.type === 'number' || input.type === 'range') v = parseFloat(v);
          child.props[key] = v;
          if (input.type === 'range') {
            var span = input.parentElement.querySelector('.range-val');
            if (span) span.textContent = v;
          }
          rerender();
          // Update list label if text/type changed
          if (key === 'text' || key === 'energyType') renderElementList();
        };
        input.addEventListener('input', handler);
        input.addEventListener('change', handler);
      });

      // Remove button
      document.getElementById('remove-child-btn').addEventListener('click', function() {
        el.children.splice(selectedChildIndex, 1);
        selectedChildIndex = null;
        rerender();
        renderElementList();
        renderPropsPanel();
      });
      return;
    }

    // ── Element selected: show element props ──
    var defs = PROP_DEFS[el.type];
    if (!defs) {
      panel.innerHTML = '<div class="no-selection">Unknown element type</div>';
      return;
    }

    for (var i = 0; i < defs.length; i++) {
      html += renderPropHtml(defs[i], el.props[defs[i].key]);
    }

    if (el.children) {
      html += '<div class="section-label">Children (' + el.children.length + ')</div>';
      html += '<div class="add-child-bar">';
      html += '<button data-add-child="text">+ Text</button>';
      html += '<button data-add-child="type-dot">+ Type Dot</button>';
      html += '<button data-add-child="suffix-logo">+ Logo</button>';
      html += '</div>';
    }

    html += '<div class="key-hint">';
    html += 'Arrows: move element<br>';
    html += 'Shift+Arrow: move x10';
    html += '</div>';

    panel.innerHTML = html;

    // Attach element prop handlers
    panel.querySelectorAll('.prop-row input, .prop-row select').forEach(function(input) {
      var key = input.dataset.key;
      var handler = function() {
        var v = input.value;
        if (input.type === 'number' || input.type === 'range') v = parseFloat(v);
        el.props[key] = v;
        if (input.type === 'range') {
          var span = input.parentElement.querySelector('.range-val');
          if (span) span.textContent = v;
        }
        if (input.dataset.position === '1') debouncedRerender();
        else rerender();
      };
      input.addEventListener('input', handler);
      input.addEventListener('change', handler);
    });

    // Add child handlers
    panel.querySelectorAll('[data-add-child]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var childType = btn.dataset.addChild;
        var newChild;
        if (childType === 'text') {
          newChild = { type: 'text', props: { text: 'Text', fontSize: 24, fontFamily: 'title', fontWeight: 'bold', fill: '#000000', opacity: 1, stroke: '', strokeWidth: 0, filter: 'none', textAnchor: 'start', grow: 0, hAlign: 'start', marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: 'top' } };
        } else if (childType === 'suffix-logo') {
          newChild = { type: 'suffix-logo', props: { suffix: 'VSTAR', height: 55, filter: 'none', grow: 0, hAlign: 'start', marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: 'bottom' } };
        } else {
          newChild = { type: 'type-dot', props: { energyType: 'Fire', radius: 28, grow: 0, hAlign: 'start', marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: 'middle' } };
        }
        el.children.push(newChild);
        rerender();
        renderElementList();
        renderPropsPanel();
      });
    });
  }

  // ── Export ──
  function copyJson() {
    var json = JSON.stringify(elements, null, 2);
    navigator.clipboard.writeText(json).then(function() { setStatus('JSON copied'); });
  }

  function copyCode() {
    if (!elements) return;
    var NL = String.fromCharCode(10);
    var BT = String.fromCharCode(96);
    var DS = String.fromCharCode(36);
    var snippets = elements.map(function(el) {
      if (el.type === 'big-logo') {
        var p = el.props;
        return 'const bigLogoH = ' + p.height + ';' + NL
          + 'const [bigLogoSvg] = renderSuffixLogo("' + p.suffix + '", ' + p.x + ', ' + p.y + ', bigLogoH);' + NL
          + 'lines.push(' + BT + '  <g opacity="' + p.opacity + '" clip-path="url(#card-clip)">' + DS + '{bigLogoSvg}</g>' + BT + ');';
      }
      return '// Element: ' + el.type + NL + JSON.stringify(el, null, 2);
    });
    navigator.clipboard.writeText(snippets.join(NL + NL)).then(function() { setStatus('Code copied'); });
  }

  function setStatus(msg) {
    document.getElementById('status').textContent = msg;
  }

  init();
})();
</script>
</body>
</html>`;
}

export { editorRouter };

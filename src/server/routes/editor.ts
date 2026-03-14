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

// POST /render — { cardId, elements }
editorRouter.post("/render", async (c) => {
  const body = await c.req.json() as { cardId?: string; elements?: ElementState[] };
  const cardId = body.cardId;
  if (!cardId) return c.text("Missing cardId", 400);

  const imageB64 = await loadCleanImageB64(cardId);
  if (!imageB64) return c.text("No clean image found for card", 404);

  let elements;
  if (body.elements) {
    try {
      elements = body.elements.map(s => createElement(s));
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
  .sidebar { width: 280px; background: #16213e; border-left: 1px solid #333; display: flex; flex-direction: column; overflow: hidden; }
  .sidebar h3 { font-size: 13px; text-transform: uppercase; color: #888; padding: 12px 12px 6px; letter-spacing: 1px; flex-shrink: 0; }
  .tree-panel { display: flex; flex-direction: column; height: 50%; min-height: 80px; overflow: hidden; }
  .element-list { padding: 0 8px; overflow-y: auto; flex: 1; }
  .splitter { height: 6px; background: #1a1a2e; cursor: row-resize; flex-shrink: 0; border-top: 1px solid #333; border-bottom: 1px solid #333; }
  .splitter:hover, .splitter.active { background: #4a9eff; }
  .props-panel-wrap { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 80px; }
  .props-panel { padding: 12px; overflow-y: auto; flex: 1; }
  .tree-item { display: flex; align-items: center; padding: 3px 4px; border-radius: 4px; cursor: pointer; font-size: 13px; margin-bottom: 1px; border: 1px solid transparent; user-select: none; }
  .tree-item:hover { background: #0f3460; }
  .tree-item.selected { background: #0f3460; border-color: #4a9eff; }
  .tree-item.level-1 { padding-left: 20px; font-size: 12px; color: #aaa; }
  .tree-item.level-2 { padding-left: 36px; font-size: 11px; color: #888; }
  .tree-item.level-1:hover, .tree-item.level-1.selected { color: #e0e0e0; }
  .tree-item.level-2:hover, .tree-item.level-2.selected { color: #e0e0e0; }
  .tree-item.dragging { opacity: 0.4; }
  .fold-btn { width: 16px; text-align: center; cursor: pointer; color: #888; font-size: 10px; flex-shrink: 0; }
  .fold-btn:hover { color: #e0e0e0; }
  .fold-spacer { width: 16px; flex-shrink: 0; }
  .vis-btn { width: 18px; text-align: center; cursor: pointer; opacity: 0.4; font-size: 11px; flex-shrink: 0; line-height: 1; }
  .vis-btn:hover { opacity: 0.8; }
  .vis-btn.is-hidden { opacity: 0.15; }
  .item-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .drop-indicator { height: 2px; background: #4a9eff; margin: 0 4px; border-radius: 1px; }
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
  .box-model { margin: 8px 0; }
  .box-layer { display: grid; grid-template-columns: 28px 1fr 28px; grid-template-rows: 22px 1fr 22px; position: relative; border: 1px dashed; border-radius: 3px; }
  .box-layer-label { position: absolute; top: 1px; left: 4px; font-size: 9px; opacity: 0.5; pointer-events: none; }
  .box-margin { border-color: rgba(246, 178, 107, 0.5); background: rgba(246, 178, 107, 0.06); }
  .box-padding { border-color: rgba(147, 196, 125, 0.5); background: rgba(147, 196, 125, 0.06); }
  .box-top { grid-column: 1 / -1; grid-row: 1; display: flex; align-items: center; justify-content: center; }
  .box-left { grid-column: 1; grid-row: 2; display: flex; align-items: center; justify-content: center; }
  .box-inner { grid-column: 2; grid-row: 2; }
  .box-right { grid-column: 3; grid-row: 2; display: flex; align-items: center; justify-content: center; }
  .box-bottom { grid-column: 1 / -1; grid-row: 3; display: flex; align-items: center; justify-content: center; }
  .box-val { width: 28px; background: transparent; border: none; color: #ccc; text-align: center; font-size: 11px; padding: 1px 0; font-family: monospace; -moz-appearance: textfield; }
  .box-val::-webkit-inner-spin-button, .box-val::-webkit-outer-spin-button { -webkit-appearance: none; }
  .box-val:focus { background: rgba(255,255,255,0.12); outline: 1px solid #4a9eff; border-radius: 2px; color: #fff; }
  .box-val:hover { background: rgba(255,255,255,0.05); }
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
    <div class="tree-panel" id="tree-panel">
      <h3>Elements</h3>
      <div class="element-list" id="element-list"></div>
    </div>
    <div class="splitter" id="splitter"></div>
    <div class="props-panel-wrap">
      <h3>Properties</h3>
      <div class="props-panel" id="props-panel">
        <div class="no-selection">Click an element to select it</div>
      </div>
    </div>
  </div>
</div>
<div class="bottom-bar">
  <button id="btn-copy-json">Copy JSON</button>
  <button id="btn-copy-code">Copy Code</button>
  <div class="status" id="status">Ready</div>
</div>

<script>
// ── <fill-picker> Custom Element ──
class FillPicker extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }
  static get observedAttributes() { return ['color', 'opacity']; }
  connectedCallback() { this._render(); }
  attributeChangedCallback() { this._render(); }

  get color() { return this.getAttribute('color') || ''; }
  set color(v) { this.setAttribute('color', v); }
  get opacity() { return parseFloat(this.getAttribute('opacity') ?? '1'); }
  set opacity(v) { this.setAttribute('opacity', String(v)); }

  _render() {
    var c = this.color;
    var o = this.opacity;
    var swatch = c || 'transparent';
    var border = c ? '1px solid ' + c : '1px dashed #666';
    this.shadowRoot.innerHTML =
      '<style>' +
      ':host { display: block; margin-bottom: 10px; }' +
      'label { display: block; font-size: 11px; color: #888; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.5px; font-family: system-ui, sans-serif; }' +
      '.row { display: flex; align-items: center; gap: 8px; }' +
      '.swatch { width: 28px; height: 28px; border-radius: 4px; flex-shrink: 0; position: relative; cursor: pointer; }' +
      '.swatch input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }' +
      'input[type=range] { flex: 1; accent-color: #4a9eff; }' +
      '.val { font-size: 11px; color: #aaa; min-width: 28px; text-align: right; font-family: system-ui, sans-serif; }' +
      '</style>' +
      '<label>Fill</label>' +
      '<div class="row">' +
        '<div class="swatch" style="background:' + swatch + ';border:' + border + ';opacity:' + o + '">' +
          '<input type="color" value="' + (c ? this._normalizeHex(c) : '#000000') + '">' +
        '</div>' +
        '<span class="val">' + o + '</span>' +
        '<input type="range" value="' + o + '" min="0" max="1" step="0.05">' +
      '</div>';

    var self = this;
    var colorInput = this.shadowRoot.querySelector('input[type=color]');
    var rangeInput = this.shadowRoot.querySelector('input[type=range]');
    colorInput.addEventListener('input', function() {
      self.setAttribute('color', colorInput.value);
      self._emit();
    });
    rangeInput.addEventListener('input', function() {
      self.setAttribute('opacity', rangeInput.value);
      self._emit();
    });
  }

  _emit() {
    this.dispatchEvent(new CustomEvent('fill-change', {
      detail: { color: this.color, opacity: this.opacity },
      bubbles: true
    }));
  }

  _normalizeHex(v) {
    var s = String(v || '#000000');
    if (/^#[0-9a-fA-F]{3}$/.test(s)) return '#' + s[1]+s[1] + s[2]+s[2] + s[3]+s[3];
    return s;
  }
}
customElements.define('fill-picker', FillPicker);

(function() {
  var BASE = '/gallery/editor';
  var elements = null;
  var selectedElementId = null;
  var selectedChildIndex = null; // null = element selected, number = child
  var selectedGrandchildIndex = null; // null = child selected, number = grandchild
  var serverPos = {};
  var debounceTimer = null;
  var cardData = null;
  var zoomLevel = 0.55;
  var panX = 0, panY = 0;
  var isPanning = false, panStartX = 0, panStartY = 0, panStartPanX = 0, panStartPanY = 0;
  var spaceHeld = false;
  var needsFit = true;
  var dragInfo = null;

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
  var ENERGY_TYPES = ['Grass','Fire','Water','Lightning','Psychic','Fighting','Darkness','Metal','Fairy','Dragon','Colorless'];

  var PROP_DEFS = {
    'box': [
      { key: 'anchorX', label: 'Anchor X', type: 'number', min: -200, max: 900, step: 1, isPosition: true },
      { key: 'anchorY', label: 'Anchor Y', type: 'number', min: -200, max: 1100, step: 1, isPosition: true },
      { key: 'direction', label: 'Direction', type: 'select', options: ['row', 'row-reverse', 'column'] },
      { key: 'width', label: 'Width', type: 'number', min: 0, max: 900, step: 1 },
      { key: 'gap', label: 'Gap', type: 'number', min: 0, max: 50, step: 1 },
      { key: 'vAnchor', label: 'V-Anchor', type: 'select', options: ['top', 'bottom'] },
      { key: 'marginTop', label: 'Margin Top', type: 'number', min: -50, max: 50, step: 1 },
      { key: 'marginRight', label: 'Margin Right', type: 'number', min: -50, max: 50, step: 1 },
      { key: 'marginBottom', label: 'Margin Bottom', type: 'number', min: -50, max: 50, step: 1 },
      { key: 'marginLeft', label: 'Margin Left', type: 'number', min: -50, max: 50, step: 1 },
      { key: 'paddingTop', label: 'Pad Top', type: 'number', min: 0, max: 50, step: 1 },
      { key: 'paddingRight', label: 'Pad Right', type: 'number', min: 0, max: 50, step: 1 },
      { key: 'paddingBottom', label: 'Pad Bottom', type: 'number', min: 0, max: 50, step: 1 },
      { key: 'paddingLeft', label: 'Pad Left', type: 'number', min: 0, max: 50, step: 1 },
      { key: 'fill', label: 'Fill', type: 'color' },
      { key: 'fillOpacity', label: 'Fill Opacity', type: 'range', min: 0, max: 1, step: 0.05 },
      { key: 'rx', label: 'Corner Radius', type: 'number', min: 0, max: 30, step: 1 },
    ],
    'image': [
      { key: 'anchorX', label: 'Anchor X', type: 'number', min: -200, max: 900, step: 1, isPosition: true },
      { key: 'anchorY', label: 'Anchor Y', type: 'number', min: -200, max: 1100, step: 1, isPosition: true },
      { key: 'src', label: 'Source', type: 'select', options: ['energy', 'logo'] },
      { key: 'energyType', label: 'Type', type: 'select', options: ENERGY_TYPES },
      { key: 'radius', label: 'Radius', type: 'number', min: 5, max: 60, step: 1 },
      { key: 'suffix', label: 'Logo', type: 'select', options: ['V', 'ex', 'VSTAR', 'VSTAR-big'] },
      { key: 'height', label: 'Height', type: 'range', min: 10, max: 600, step: 1 },
      { key: 'opacity', label: 'Opacity', type: 'range', min: 0, max: 1, step: 0.05 },
      { key: 'clipToCard', label: 'Clip', type: 'select', options: ['0', '1'] },
      { key: 'filter', label: 'Filter', type: 'select', options: ['none', 'shadow', 'title-shadow'] },
    ],
  };

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
      { key: 'wrap', label: 'Wrap', type: 'select', options: ['0', '1'] },
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
    'image': [
      { key: 'src', label: 'Source', type: 'select', options: ['energy', 'logo'] },
      { key: 'energyType', label: 'Type', type: 'select', options: ENERGY_TYPES },
      { key: 'radius', label: 'Radius', type: 'number', min: 5, max: 60, step: 1 },
      { key: 'suffix', label: 'Logo', type: 'select', options: ['V', 'ex', 'VSTAR', 'VSTAR-big'] },
      { key: 'height', label: 'Height', type: 'number', min: 10, max: 600, step: 1 },
      { key: 'opacity', label: 'Opacity', type: 'range', min: 0, max: 1, step: 0.05 },
      { key: 'clipToCard', label: 'Clip', type: 'select', options: ['0', '1'] },
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
    'box': [
      { key: 'direction', label: 'Direction', type: 'select', options: ['row', 'row-reverse', 'column'] },
      { key: 'width', label: 'Width', type: 'number', min: 0, max: 900, step: 1 },
      { key: 'gap', label: 'Gap', type: 'number', min: 0, max: 50, step: 1 },
      { key: 'fill', label: 'Fill', type: 'color' },
      { key: 'fillOpacity', label: 'Fill Opacity', type: 'range', min: 0, max: 1, step: 0.05 },
      { key: 'rx', label: 'Corner Radius', type: 'number', min: 0, max: 30, step: 1 },
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
      return '"' + t + '"' + (Number(child.props.wrap) ? ' wrap' : ' text');
    }
    if (child.type === 'image') {
      if (String(child.props.src) === 'energy') {
        return String(child.props.energyType || '?') + ' dot';
      }
      return String(child.props.suffix || '?') + ' logo';
    }
    if (child.type === 'box') {
      var dir = String(child.props.direction || 'row');
      var label = dir === 'column' ? 'col' : 'row';
      return label + ' (' + (child.children ? child.children.length : 0) + ')';
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

  function stripInternalProps(elems) {
    var clean = JSON.parse(JSON.stringify(elems));
    function walk(arr) {
      if (!arr) return;
      for (var i = 0; i < arr.length; i++) {
        delete arr[i]._hidden;
        delete arr[i]._collapsed;
        if (arr[i].children) walk(arr[i].children);
      }
    }
    walk(clean);
    return clean;
  }

  // ── Apply visibility: hide elements in rendered SVG without affecting layout ──
  function applyVisibility(svgEl) {
    if (!svgEl || !elements) return;
    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      var g = svgEl.querySelector('[data-element-id="' + el.id + '"]');
      if (!g) continue;
      g.style.display = el._hidden ? 'none' : '';
      if (el.children) {
        for (var ci = 0; ci < el.children.length; ci++) {
          var child = el.children[ci];
          var childG = g.querySelector(':scope > [data-child-index="' + ci + '"]');
          if (!childG) continue;
          childG.style.display = child._hidden ? 'none' : '';
          if (child.children) {
            for (var gi = 0; gi < child.children.length; gi++) {
              var gc = child.children[gi];
              var gcG = childG.querySelector(':scope > g > [data-child-index="' + gi + '"]');
              if (gcG) gcG.style.display = gc._hidden ? 'none' : '';
            }
          }
        }
      }
    }
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
        type: 'image', id: 'big-logo-1',
        props: { src: 'logo', suffix: 'VSTAR-big', height: 280, opacity: 0.85, clipToCard: 1, anchorX: -50, anchorY: -38 }
      },
      {
        type: 'box', id: 'hp-cluster-1',
        props: { anchorX: 514, anchorY: 42, direction: 'row' },
        children: [
          { type: 'text', props: { text: 'HP', fontSize: 25, fontFamily: 'title', fontWeight: 'bold', fill: '#ffffff', opacity: 1, stroke: '', strokeWidth: 0, filter: 'none', textAnchor: 'start', wrap: 0, marginTop: 0, marginRight: 4, marginBottom: 4, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: 'bottom' }, bind: {} },
          { type: 'text', props: { text: '280', fontSize: 52, fontFamily: 'title', fontWeight: 'bold', fill: '#ffffff', opacity: 1, stroke: '#000000', strokeWidth: 0, filter: 'title-shadow', textAnchor: 'start', wrap: 0, marginTop: 0, marginRight: 6, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: 'bottom' }, bind: { text: 'hp' } },
          { type: 'image', props: { src: 'energy', energyType: 'Fire', radius: 25, marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: 'middle' }, bind: { energyType: 'types[0]' } },
        ]
      },
      {
        type: 'box', id: 'name-cluster-1',
        props: { anchorX: 45, anchorY: 46, direction: 'row' },
        children: [
          { type: 'text', props: { text: 'Arcanine', fontSize: 48, fontFamily: 'title', fontWeight: 'bold', fill: '#ffffff', opacity: 1, stroke: '#000000', strokeWidth: 2.5, filter: 'title-shadow', textAnchor: 'start', wrap: 0, marginTop: 0, marginRight: 0, marginBottom: 6, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: 'bottom' }, bind: { text: '_baseName' } },
          { type: 'image', props: { src: 'logo', suffix: 'ex', height: 55, filter: 'title-shadow', marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 4, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: 'bottom' }, bind: { suffix: '_nameSuffix' } },
        ]
      },
      {
        type: 'box', id: 'evolves-from-1',
        props: { anchorX: 47, anchorY: 98, direction: 'row' },
        children: [
          { type: 'text', props: { text: 'Evolves from', fontSize: 18, fontFamily: 'body', fontWeight: 'bold', fill: '#ffffff', opacity: 0.7, stroke: '', strokeWidth: 0, filter: 'shadow', textAnchor: 'start', wrap: 0, grow: 0, hAlign: 'start', marginTop: 0, marginRight: 6, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: 'middle' } },
          { type: 'text', props: { text: 'Growlithe', fontSize: 18, fontFamily: 'title', fontWeight: 'bold', fill: '#ffffff', opacity: 1, stroke: '', strokeWidth: 0, filter: 'shadow', textAnchor: 'start', wrap: 0, grow: 0, hAlign: 'start', marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: 'middle' }, bind: { text: 'evolveFrom' } },
        ]
      },
      {
        type: 'box', id: 'attack-block-1',
        props: { anchorX: 20, anchorY: 0, width: 710, direction: 'column', vAnchor: 'bottom', paddingTop: 4, paddingRight: 8, paddingBottom: 37, paddingLeft: 8, fill: '#e6a7a7', fillOpacity: 0.1, rx: 5 },
        children: [
          { type: 'box', props: { direction: 'row' }, children: [
            { type: 'image', props: { src: 'energy', energyType: 'Fire', radius: 14, grow: 0, hAlign: 'start', marginTop: 0, marginRight: 4, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: 'middle' }, bind: { energyType: 'attacks[0].cost[0]' } },
            { type: 'image', props: { src: 'energy', energyType: 'Fire', radius: 14, grow: 0, hAlign: 'start', marginTop: 0, marginRight: 6, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: 'middle' }, bind: { energyType: 'attacks[0].cost[1]' } },
            { type: 'text', props: { text: 'Raging Claws', fontSize: 28, fontFamily: 'title', fontWeight: 'bold', fill: '#ffffff', opacity: 1, stroke: '', strokeWidth: 0, filter: 'shadow', textAnchor: 'start', wrap: 0, grow: 1, hAlign: 'start', marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: 'middle' }, bind: { text: 'attacks[0].name' } },
            { type: 'text', props: { text: '30+', fontSize: 36, fontFamily: 'title', fontWeight: 'bold', fill: '#cc0000', opacity: 1, stroke: '', strokeWidth: 0, filter: 'shadow', textAnchor: 'start', wrap: 0, grow: 0, hAlign: 'end', marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: 'middle' }, bind: { text: 'attacks[0].damage' } },
          ]},
          { type: 'text', props: {
            text: 'This attack does 10 more damage for each damage counter on this Pok\u00e9mon.',
            fontSize: 27, fontFamily: 'body', fontWeight: 'bold', fill: '#ffffff', opacity: 1, filter: 'title-shadow', wrap: 1, marginTop: 4,
          }, bind: { text: 'attacks[0].effect' } },
          { type: 'box', props: { direction: 'row', marginTop: 6 }, children: [
            { type: 'image', props: { src: 'energy', energyType: 'Fire', radius: 14, grow: 0, hAlign: 'start', marginTop: 0, marginRight: 4, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: 'middle' }, bind: { energyType: 'attacks[1].cost[0]' } },
            { type: 'image', props: { src: 'energy', energyType: 'Fire', radius: 14, grow: 0, hAlign: 'start', marginTop: 0, marginRight: 4, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: 'middle' }, bind: { energyType: 'attacks[1].cost[1]' } },
            { type: 'image', props: { src: 'energy', energyType: 'Fire', radius: 14, grow: 0, hAlign: 'start', marginTop: 0, marginRight: 6, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: 'middle' }, bind: { energyType: 'attacks[1].cost[2]' } },
            { type: 'text', props: { text: 'Bright Flame', fontSize: 28, fontFamily: 'title', fontWeight: 'bold', fill: '#222222', opacity: 1, stroke: '', strokeWidth: 0, filter: 'shadow', textAnchor: 'start', wrap: 0, grow: 1, hAlign: 'start', marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: 'middle' }, bind: { text: 'attacks[1].name' } },
            { type: 'text', props: { text: '250', fontSize: 36, fontFamily: 'title', fontWeight: 'bold', fill: '#cc0000', opacity: 1, stroke: '', strokeWidth: 0, filter: 'shadow', textAnchor: 'start', wrap: 0, grow: 0, hAlign: 'end', marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: 'middle' }, bind: { text: 'attacks[1].damage' } },
          ]},
          { type: 'text', props: {
            text: 'Discard 2 {R} Energy from this Pok\u00e9mon.',
            fontSize: 20, fontFamily: 'body', fontWeight: 'bold', fill: '#222222', opacity: 1, filter: 'shadow', wrap: 1, marginTop: 4,
          }, bind: { text: 'attacks[1].effect' } },
          { type: 'box', props: { direction: 'row', marginTop: 4 }, children: [
            { type: 'text', props: { text: 'Weak', fontSize: 14, fontFamily: 'body', fontWeight: 'bold', fill: '#888888', opacity: 1, stroke: '', strokeWidth: 0, filter: 'none', textAnchor: 'start', wrap: 0, grow: 0, hAlign: 'start', marginTop: 0, marginRight: 4, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: 'middle' } },
            { type: 'image', props: { src: 'energy', energyType: 'Lightning', radius: 12, grow: 0, hAlign: 'start', marginTop: 0, marginRight: 4, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: 'middle' }, bind: { energyType: 'weaknesses[0].type' } },
            { type: 'text', props: { text: '×2', fontSize: 22, fontFamily: 'body', fontWeight: 'bold', fill: '#222222', opacity: 1, stroke: '', strokeWidth: 0, filter: 'shadow', textAnchor: 'start', wrap: 0, grow: 0, hAlign: 'start', marginTop: 0, marginRight: 16, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: 'middle' }, bind: { text: 'weaknesses[0].value' } },
            { type: 'text', props: { text: 'Resist', fontSize: 14, fontFamily: 'body', fontWeight: 'bold', fill: '#888888', opacity: 1, stroke: '', strokeWidth: 0, filter: 'none', textAnchor: 'start', wrap: 0, grow: 0, hAlign: 'start', marginTop: 0, marginRight: 4, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: 'middle' } },
            { type: 'image', props: { src: 'energy', energyType: 'Fighting', radius: 12, grow: 0, hAlign: 'start', marginTop: 0, marginRight: 4, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: 'middle' }, bind: { energyType: 'resistances[0].type' } },
            { type: 'text', props: { text: '-30', fontSize: 22, fontFamily: 'body', fontWeight: 'bold', fill: '#222222', opacity: 1, stroke: '', strokeWidth: 0, filter: 'shadow', textAnchor: 'start', wrap: 0, grow: 1, hAlign: 'start', marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: 'middle' }, bind: { text: 'resistances[0].value' } },
            { type: 'text', props: { text: 'Retreat', fontSize: 14, fontFamily: 'body', fontWeight: 'bold', fill: '#888888', opacity: 1, stroke: '', strokeWidth: 0, filter: 'none', textAnchor: 'start', wrap: 0, grow: 0, hAlign: 'start', marginTop: 0, marginRight: 4, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: 'middle' } },
            { type: 'image', props: { src: 'energy', energyType: 'Colorless', radius: 12, grow: 0, hAlign: 'start', marginTop: 0, marginRight: 4, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: 'middle' } },
            { type: 'image', props: { src: 'energy', energyType: 'Colorless', radius: 12, grow: 0, hAlign: 'start', marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: 'middle' } },
          ]},
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

    // Space key for pan mode (Photoshop-style)
    window.addEventListener('keydown', function(e) {
      if (e.code === 'Space' && !e.repeat && !spaceHeld) {
        // Don't hijack space when typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
        e.preventDefault();
        spaceHeld = true;
        cardsArea.classList.add('panning');
      }
    });
    window.addEventListener('keyup', function(e) {
      if (e.code === 'Space' && spaceHeld) {
        spaceHeld = false;
        if (!isPanning) cardsArea.classList.remove('panning');
      }
    });

    // Pan with click-drag: space+drag anywhere, middle-click, or drag on background
    cardsArea.addEventListener('mousedown', function(e) {
      if (e.button === 1 || (e.button === 0 && spaceHeld) || (e.button === 0 && (e.target === cardsArea || e.target.id === 'cards-inner' || e.target.id === 'ref-card'))) {
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
        if (!spaceHeld) cardsArea.classList.remove('panning');
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

    // ── Splitter drag ──
    var splitterEl = document.getElementById('splitter');
    var treePanelEl = document.getElementById('tree-panel');
    var isResizingSplitter = false;
    splitterEl.addEventListener('mousedown', function(e) {
      e.preventDefault();
      isResizingSplitter = true;
      splitterEl.classList.add('active');
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
    });
    window.addEventListener('mousemove', function(e) {
      if (!isResizingSplitter) return;
      var sidebarEl = document.querySelector('.sidebar');
      var sidebarRect = sidebarEl.getBoundingClientRect();
      var newHeight = e.clientY - sidebarRect.top;
      newHeight = Math.max(80, Math.min(newHeight, sidebarRect.height - 80));
      treePanelEl.style.height = newHeight + 'px';
      treePanelEl.style.flex = 'none';
    });
    window.addEventListener('mouseup', function() {
      if (isResizingSplitter) {
        isResizingSplitter = false;
        splitterEl.classList.remove('active');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    });
  }

  // ── Card pick + data binding ──
  async function onCardPicked(cardId) {
    location.hash = cardId;
    needsFit = true;

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

  function applyBindingsToItem(item) {
    if (!item.bind) return;
    var keys = Object.keys(item.bind);
    for (var ki = 0; ki < keys.length; ki++) {
      var propKey = keys[ki];
      var val = resolveBinding(item.bind[propKey], cardData);
      if (val !== undefined) {
        item.props[propKey] = val;
      }
    }
  }

  function applyBindings() {
    if (!cardData || !elements) return;
    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      if (!el.children) continue;
      for (var ci = 0; ci < el.children.length; ci++) {
        var child = el.children[ci];
        applyBindingsToItem(child);
        // Walk grandchildren
        if (child.children) {
          for (var gi = 0; gi < child.children.length; gi++) {
            applyBindingsToItem(child.children[gi]);
          }
        }
      }
    }
  }

  // ── Load card ──
  async function loadCard(cardId) {
    setStatus('Loading...');
    var resp = await fetch(BASE + '/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardId: cardId, elements: stripInternalProps(elements) })
    });
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
    applyVisibility(svgEl);
    setStatus('Ready');
    if (needsFit) {
      needsFit = false;
      // Delay to let ref image load and layout settle
      setTimeout(zoomToFit, 100);
    }
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
      if (node.dataset && node.dataset.childIndex != null) {
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

  function selectItem(elementId, childIndex, grandchildIndex) {
    selectedElementId = elementId;
    selectedChildIndex = (childIndex != null) ? childIndex : null;
    selectedGrandchildIndex = (grandchildIndex != null) ? grandchildIndex : null;
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
      var childG = parentG.querySelector(':scope > [data-child-index="' + selectedChildIndex + '"]');
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

    // ── Grandchild selected ──
    if (selectedGrandchildIndex != null && selectedChildIndex != null && el.children) {
      var child = el.children[selectedChildIndex];
      if (!child || !child.children) return;
      var gi = selectedGrandchildIndex;
      var grandchild = child.children[gi];
      if (!grandchild) return;

      // Ctrl/Cmd + Left/Right: reorder grandchild in parent's children array
      if (e.ctrlKey || e.metaKey) {
        var newGi = gi;
        if (e.key === 'ArrowLeft' && gi > 0) newGi = gi - 1;
        if (e.key === 'ArrowRight' && gi < child.children.length - 1) newGi = gi + 1;
        if (newGi !== gi) {
          var tmp = child.children[gi];
          child.children[gi] = child.children[newGi];
          child.children[newGi] = tmp;
          selectedGrandchildIndex = newGi;
          rerender();
          renderElementList();
          renderPropsPanel();
        }
        return;
      }

      // Plain arrows: nudge grandchild via margin
      if (e.key === 'ArrowRight') grandchild.props.marginLeft = Number(grandchild.props.marginLeft || 0) + step;
      if (e.key === 'ArrowLeft')  grandchild.props.marginLeft = Number(grandchild.props.marginLeft || 0) - step;
      if (e.key === 'ArrowDown')  grandchild.props.marginTop = Number(grandchild.props.marginTop || 0) + step;
      if (e.key === 'ArrowUp')    grandchild.props.marginTop = Number(grandchild.props.marginTop || 0) - step;
      renderPropsPanel();
      debouncedRerender();
      return;
    }

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
          if (el.type === 'box') {
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

  // ── Element list (hierarchical with fold/visibility/drag) ──
  function renderElementList() {
    var list = document.getElementById('element-list');
    if (!elements) { list.innerHTML = ''; return; }
    var html = '';
    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      var isElSelected = (el.id === selectedElementId && selectedChildIndex == null);
      var hasChildren = el.children && el.children.length > 0;

      html += '<div class="tree-item level-0' + (isElSelected ? ' selected' : '') + '"'
        + ' draggable="true" data-idx="' + i + '" data-id="' + el.id + '">';
      if (hasChildren) {
        html += '<span class="fold-btn" data-idx="' + i + '">' + (el._collapsed ? '&#9656;' : '&#9662;') + '</span>';
      } else {
        html += '<span class="fold-spacer"></span>';
      }
      html += '<span class="vis-btn' + (el._hidden ? ' is-hidden' : '') + '" data-idx="' + i + '">\u{1F441}</span>';
      html += '<span class="item-label">' + el.id + '</span>';
      html += '</div>';

      if (hasChildren && !el._collapsed) {
        for (var ci = 0; ci < el.children.length; ci++) {
          var child = el.children[ci];
          var isChildSelected = (el.id === selectedElementId && selectedChildIndex === ci && selectedGrandchildIndex == null);
          var childHasKids = child.children && child.children.length > 0;

          html += '<div class="tree-item level-1' + (isChildSelected ? ' selected' : '') + '"'
            + ' draggable="true" data-idx="' + i + '" data-id="' + el.id + '" data-child="' + ci + '">';
          if (childHasKids) {
            html += '<span class="fold-btn" data-idx="' + i + '" data-child="' + ci + '">' + (child._collapsed ? '&#9656;' : '&#9662;') + '</span>';
          } else {
            html += '<span class="fold-spacer"></span>';
          }
          html += '<span class="vis-btn' + (child._hidden ? ' is-hidden' : '') + '" data-idx="' + i + '" data-child="' + ci + '">\u{1F441}</span>';
          html += '<span class="item-label">' + getChildLabel(child) + '</span>';
          html += '</div>';

          if (childHasKids && !child._collapsed) {
            for (var gi = 0; gi < child.children.length; gi++) {
              var gc = child.children[gi];
              var isGcSelected = (el.id === selectedElementId && selectedChildIndex === ci && selectedGrandchildIndex === gi);

              html += '<div class="tree-item level-2' + (isGcSelected ? ' selected' : '') + '"'
                + ' draggable="true" data-idx="' + i + '" data-id="' + el.id + '" data-child="' + ci + '" data-grandchild="' + gi + '">';
              html += '<span class="fold-spacer"></span>';
              html += '<span class="vis-btn' + (gc._hidden ? ' is-hidden' : '') + '" data-idx="' + i + '" data-child="' + ci + '" data-grandchild="' + gi + '">\u{1F441}</span>';
              html += '<span class="item-label">' + getChildLabel(gc) + '</span>';
              html += '</div>';
            }
          }
        }
      }
    }
    list.innerHTML = html;

    // Selection click handlers
    list.querySelectorAll('.tree-item').forEach(function(item) {
      item.addEventListener('click', function(e) {
        if (e.target.classList.contains('fold-btn') || e.target.classList.contains('vis-btn')) return;
        var elId = item.dataset.id;
        var childIdx = (item.dataset.child != null) ? parseInt(item.dataset.child) : null;
        var gcIdx = (item.dataset.grandchild != null) ? parseInt(item.dataset.grandchild) : null;
        selectItem(elId, childIdx, gcIdx);
      });
    });

    // Fold toggle handlers
    list.querySelectorAll('.fold-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var idx = parseInt(btn.dataset.idx);
        if (btn.dataset.child != null) {
          var ci = parseInt(btn.dataset.child);
          elements[idx].children[ci]._collapsed = !elements[idx].children[ci]._collapsed;
        } else {
          elements[idx]._collapsed = !elements[idx]._collapsed;
        }
        renderElementList();
      });
    });

    // Visibility toggle handlers
    list.querySelectorAll('.vis-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var idx = parseInt(btn.dataset.idx);
        if (btn.dataset.grandchild != null) {
          var ci = parseInt(btn.dataset.child);
          var gi = parseInt(btn.dataset.grandchild);
          elements[idx].children[ci].children[gi]._hidden = !elements[idx].children[ci].children[gi]._hidden;
        } else if (btn.dataset.child != null) {
          var ci = parseInt(btn.dataset.child);
          elements[idx].children[ci]._hidden = !elements[idx].children[ci]._hidden;
        } else {
          elements[idx]._hidden = !elements[idx]._hidden;
        }
        renderElementList();
        var svgEl = document.querySelector('#canvas-wrap svg');
        if (svgEl) applyVisibility(svgEl);
      });
    });

    // Drag and drop
    setupTreeDragDrop();
  }

  function setupTreeDragDrop() {
    var list = document.getElementById('element-list');
    var items = list.querySelectorAll('.tree-item');

    items.forEach(function(item) {
      item.addEventListener('dragstart', function(e) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', '');
        dragInfo = {
          idx: parseInt(item.dataset.idx),
          child: item.dataset.child != null ? parseInt(item.dataset.child) : null,
          grandchild: item.dataset.grandchild != null ? parseInt(item.dataset.grandchild) : null
        };
        item.classList.add('dragging');
      });

      item.addEventListener('dragend', function() {
        dragInfo = null;
        item.classList.remove('dragging');
        removeDropIndicators();
      });

      item.addEventListener('dragover', function(e) {
        if (!dragInfo) return;
        var tgtIdx = parseInt(item.dataset.idx);
        var tgtChild = item.dataset.child != null ? parseInt(item.dataset.child) : null;
        var tgtGc = item.dataset.grandchild != null ? parseInt(item.dataset.grandchild) : null;
        var srcLevel = dragInfo.grandchild != null ? 2 : (dragInfo.child != null ? 1 : 0);
        var tgtLevel = tgtGc != null ? 2 : (tgtChild != null ? 1 : 0);

        if (srcLevel !== tgtLevel) return;
        if (srcLevel === 1 && dragInfo.idx !== tgtIdx) return;
        if (srcLevel === 2 && (dragInfo.idx !== tgtIdx || dragInfo.child !== tgtChild)) return;

        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        removeDropIndicators();
        var rect = item.getBoundingClientRect();
        var indicator = document.createElement('div');
        indicator.className = 'drop-indicator';
        if (e.clientY > rect.top + rect.height / 2) {
          item.after(indicator);
        } else {
          item.before(indicator);
        }
      });

      item.addEventListener('dragleave', function() {
        removeDropIndicators();
      });

      item.addEventListener('drop', function(e) {
        e.preventDefault();
        if (!dragInfo) return;
        var tgtIdx = parseInt(item.dataset.idx);
        var tgtChild = item.dataset.child != null ? parseInt(item.dataset.child) : null;
        var tgtGc = item.dataset.grandchild != null ? parseInt(item.dataset.grandchild) : null;
        var srcLevel = dragInfo.grandchild != null ? 2 : (dragInfo.child != null ? 1 : 0);
        var tgtLevel = tgtGc != null ? 2 : (tgtChild != null ? 1 : 0);

        if (srcLevel !== tgtLevel) { dragInfo = null; removeDropIndicators(); return; }

        var rect = item.getBoundingClientRect();
        var insertAfter = e.clientY > rect.top + rect.height / 2;

        if (srcLevel === 0) {
          var si = dragInfo.idx, ti = tgtIdx;
          if (insertAfter) ti++;
          if (si < ti) ti--;
          if (si !== ti) {
            var moved = elements.splice(si, 1)[0];
            elements.splice(ti, 0, moved);
          }
        } else if (srcLevel === 1) {
          if (dragInfo.idx !== tgtIdx) { dragInfo = null; removeDropIndicators(); return; }
          var parent = elements[tgtIdx];
          var si = dragInfo.child, ti = tgtChild;
          if (insertAfter) ti++;
          if (si < ti) ti--;
          if (si !== ti) {
            var moved = parent.children.splice(si, 1)[0];
            parent.children.splice(ti, 0, moved);
            if (selectedElementId === parent.id && selectedChildIndex === si) selectedChildIndex = ti;
          }
        } else if (srcLevel === 2) {
          if (dragInfo.idx !== tgtIdx || dragInfo.child !== tgtChild) { dragInfo = null; removeDropIndicators(); return; }
          var child = elements[tgtIdx].children[tgtChild];
          var si = dragInfo.grandchild, ti = tgtGc;
          if (insertAfter) ti++;
          if (si < ti) ti--;
          if (si !== ti) {
            var moved = child.children.splice(si, 1)[0];
            child.children.splice(ti, 0, moved);
            if (selectedGrandchildIndex === si) selectedGrandchildIndex = ti;
          }
        }

        dragInfo = null;
        removeDropIndicators();
        rerender();
        renderElementList();
        renderPropsPanel();
      });
    });
  }

  function removeDropIndicators() {
    document.querySelectorAll('.drop-indicator').forEach(function(el) { el.remove(); });
  }

  var BOX_MODEL_KEYS = {marginTop:1,marginRight:1,marginBottom:1,marginLeft:1,paddingTop:1,paddingRight:1,paddingBottom:1,paddingLeft:1};
  var FILL_KEYS = {fill:1,fillOpacity:1};

  function renderBoxModelHtml(props) {
    var mt = props.marginTop || 0, mr = props.marginRight || 0, mb = props.marginBottom || 0, ml = props.marginLeft || 0;
    var pt = props.paddingTop || 0, pr = props.paddingRight || 0, pb = props.paddingBottom || 0, pl = props.paddingLeft || 0;
    var h = '<div class="box-model">';
    h += '<div class="box-layer box-margin">';
    h += '<span class="box-layer-label">margin</span>';
    h += '<div class="box-top"><input class="box-val" type="number" data-box-key="marginTop" value="' + mt + '"></div>';
    h += '<div class="box-left"><input class="box-val" type="number" data-box-key="marginLeft" value="' + ml + '"></div>';
    h += '<div class="box-inner">';
    h += '<div class="box-layer box-padding">';
    h += '<span class="box-layer-label">padding</span>';
    h += '<div class="box-top"><input class="box-val" type="number" data-box-key="paddingTop" value="' + pt + '"></div>';
    h += '<div class="box-left"><input class="box-val" type="number" data-box-key="paddingLeft" value="' + pl + '"></div>';
    h += '<div class="box-inner"></div>';
    h += '<div class="box-right"><input class="box-val" type="number" data-box-key="paddingRight" value="' + pr + '"></div>';
    h += '<div class="box-bottom"><input class="box-val" type="number" data-box-key="paddingBottom" value="' + pb + '"></div>';
    h += '</div></div>';
    h += '<div class="box-right"><input class="box-val" type="number" data-box-key="marginRight" value="' + mr + '"></div>';
    h += '<div class="box-bottom"><input class="box-val" type="number" data-box-key="marginBottom" value="' + mb + '"></div>';
    h += '</div></div>';
    return h;
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

    // ── Grandchild selected: show grandchild props ──
    if (selectedGrandchildIndex != null && selectedChildIndex != null && el.children) {
      var child = el.children[selectedChildIndex];
      if (!child || !child.children) { panel.innerHTML = ''; return; }
      var grandchild = child.children[selectedGrandchildIndex];
      if (!grandchild) { panel.innerHTML = ''; return; }

      var subDefs = SUB_PROP_DEFS[grandchild.type] || [];
      var hasBox = false, hasFill = false;
      html += '<div class="section-label">' + grandchild.type + ' #' + selectedGrandchildIndex + '</div>';
      for (var i = 0; i < subDefs.length; i++) {
        if (BOX_MODEL_KEYS[subDefs[i].key]) { hasBox = true; continue; }
        if (FILL_KEYS[subDefs[i].key]) { hasFill = true; continue; }
        html += renderPropHtml(subDefs[i], grandchild.props[subDefs[i].key]);
      }
      if (hasFill) html += '<fill-picker color="' + (grandchild.props.fill || '') + '" opacity="' + (grandchild.props.fillOpacity != null ? grandchild.props.fillOpacity : 1) + '"></fill-picker>';
      if (hasBox) html += renderBoxModelHtml(grandchild.props);
      html += '<button class="remove-btn" id="remove-grandchild-btn">Remove</button>';
      html += '<div class="key-hint">';
      html += 'Arrows: nudge margin<br>';
      html += 'Shift+Arrow: nudge x10<br>';
      html += 'Ctrl+Left/Right: reorder';
      html += '</div>';

      panel.innerHTML = html;

      panel.querySelectorAll('.prop-row input, .prop-row select').forEach(function(input) {
        var key = input.dataset.key;
        var handler = function() {
          var v = input.value;
          if (input.type === 'number' || input.type === 'range') v = parseFloat(v);
          grandchild.props[key] = v;
          if (input.type === 'range') {
            var span = input.parentElement.querySelector('.range-val');
            if (span) span.textContent = v;
          }
          rerender();
          if (key === 'text' || key === 'energyType') renderElementList();
        };
        input.addEventListener('input', handler);
        input.addEventListener('change', handler);
      });
      panel.querySelectorAll('.box-val').forEach(function(input) {
        input.addEventListener('change', function() {
          grandchild.props[input.dataset.boxKey] = parseInt(input.value) || 0;
          debouncedRerender();
        });
      });
      panel.querySelectorAll('fill-picker').forEach(function(fp) {
        fp.addEventListener('fill-change', function(e) {
          grandchild.props.fill = e.detail.color;
          grandchild.props.fillOpacity = e.detail.opacity;
          rerender();
        });
      });

      document.getElementById('remove-grandchild-btn').addEventListener('click', function() {
        child.children.splice(selectedGrandchildIndex, 1);
        selectedGrandchildIndex = null;
        rerender();
        renderElementList();
        renderPropsPanel();
      });
      return;
    }

    // ── Child selected: show child props only ──
    if (selectedChildIndex != null && el.children) {
      var child = el.children[selectedChildIndex];
      if (!child) { panel.innerHTML = ''; return; }

      var subDefs = SUB_PROP_DEFS[child.type] || [];
      var hasBox = false, hasFill = false;
      html += '<div class="section-label">' + child.type + ' #' + selectedChildIndex + '</div>';
      for (var i = 0; i < subDefs.length; i++) {
        if (BOX_MODEL_KEYS[subDefs[i].key]) { hasBox = true; continue; }
        if (FILL_KEYS[subDefs[i].key]) { hasFill = true; continue; }
        html += renderPropHtml(subDefs[i], child.props[subDefs[i].key]);
      }
      if (hasFill) html += '<fill-picker color="' + (child.props.fill || '') + '" opacity="' + (child.props.fillOpacity != null ? child.props.fillOpacity : 1) + '"></fill-picker>';
      if (hasBox) html += renderBoxModelHtml(child.props);

      // If child is a box, show add-grandchild buttons
      if (child.type === 'box') {
        html += '<div class="section-label">Children (' + (child.children ? child.children.length : 0) + ')</div>';
        html += '<div class="add-child-bar">';
        html += '<button data-add-grandchild="text">+ Text</button>';
        html += '<button data-add-grandchild="image-energy">+ Energy</button>';
        html += '<button data-add-grandchild="image-logo">+ Logo</button>';
        html += '</div>';
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
      panel.querySelectorAll('.box-val').forEach(function(input) {
        input.addEventListener('change', function() {
          child.props[input.dataset.boxKey] = parseInt(input.value) || 0;
          debouncedRerender();
        });
      });
      panel.querySelectorAll('fill-picker').forEach(function(fp) {
        fp.addEventListener('fill-change', function(e) {
          child.props.fill = e.detail.color;
          child.props.fillOpacity = e.detail.opacity;
          rerender();
        });
      });

      // Add grandchild handlers
      panel.querySelectorAll('[data-add-grandchild]').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var gcType = btn.dataset.addGrandchild;
          var newGc;
          if (gcType === 'text') {
            newGc = { type: 'text', props: { text: 'Text', fontSize: 24, fontFamily: 'title', fontWeight: 'bold', fill: '#000000', opacity: 1, stroke: '', strokeWidth: 0, filter: 'none', textAnchor: 'start', wrap: 0, grow: 0, hAlign: 'start', marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: 'top' } };
          } else if (gcType === 'image-logo') {
            newGc = { type: 'image', props: { src: 'logo', suffix: 'VSTAR', height: 55, filter: 'none', opacity: 1, clipToCard: 0, grow: 0, hAlign: 'start', marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: 'bottom' } };
          } else {
            newGc = { type: 'image', props: { src: 'energy', energyType: 'Fire', radius: 28, grow: 0, hAlign: 'start', marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: 'middle' } };
          }
          if (!child.children) child.children = [];
          child.children.push(newGc);
          rerender();
          renderElementList();
          renderPropsPanel();
        });
      });

      // Remove button
      document.getElementById('remove-child-btn').addEventListener('click', function() {
        el.children.splice(selectedChildIndex, 1);
        selectedChildIndex = null;
        selectedGrandchildIndex = null;
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

    html += '<div class="section-label">' + el.type + (el.id ? ' — ' + el.id : '') + '</div>';

    var hasBox = false, hasFill = false;
    for (var i = 0; i < defs.length; i++) {
      if (BOX_MODEL_KEYS[defs[i].key]) { hasBox = true; continue; }
      if (FILL_KEYS[defs[i].key]) { hasFill = true; continue; }
      html += renderPropHtml(defs[i], el.props[defs[i].key]);
    }
    if (hasFill) html += '<fill-picker color="' + (el.props.fill || '') + '" opacity="' + (el.props.fillOpacity != null ? el.props.fillOpacity : 1) + '"></fill-picker>';
    if (hasBox) html += renderBoxModelHtml(el.props);

    if (el.children) {
      html += '<div class="section-label">Children (' + el.children.length + ')</div>';
      html += '<div class="add-child-bar">';
      html += '<button data-add-child="text">+ Text</button>';
      html += '<button data-add-child="text-wrap">+ Wrap Text</button>';
      html += '<button data-add-child="image-energy">+ Energy</button>';
      html += '<button data-add-child="image-logo">+ Logo</button>';
      html += '<button data-add-child="box">+ Box</button>';
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
    panel.querySelectorAll('.box-val').forEach(function(input) {
      input.addEventListener('change', function() {
        el.props[input.dataset.boxKey] = parseInt(input.value) || 0;
        debouncedRerender();
      });
    });
    panel.querySelectorAll('fill-picker').forEach(function(fp) {
      fp.addEventListener('fill-change', function(e) {
        el.props.fill = e.detail.color;
        el.props.fillOpacity = e.detail.opacity;
        rerender();
      });
    });

    // Add child handlers
    panel.querySelectorAll('[data-add-child]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var childType = btn.dataset.addChild;
        var newChild;
        if (childType === 'text') {
          newChild = { type: 'text', props: { text: 'Text', fontSize: 24, fontFamily: 'title', fontWeight: 'bold', fill: '#000000', opacity: 1, stroke: '', strokeWidth: 0, filter: 'none', textAnchor: 'start', wrap: 0, grow: 0, hAlign: 'start', marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: 'top' } };
        } else if (childType === 'text-wrap') {
          newChild = { type: 'text', props: { text: 'Description text', fontSize: 20, fontFamily: 'body', fontWeight: 'bold', fill: '#222222', opacity: 1, stroke: '', strokeWidth: 0, filter: 'none', textAnchor: 'start', wrap: 1, grow: 0, hAlign: 'start', marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: 'top' } };
        } else if (childType === 'image-logo') {
          newChild = { type: 'image', props: { src: 'logo', suffix: 'VSTAR', height: 55, filter: 'none', opacity: 1, clipToCard: 0, grow: 0, hAlign: 'start', marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: 'bottom' } };
        } else if (childType === 'image-energy') {
          newChild = { type: 'image', props: { src: 'energy', energyType: 'Fire', radius: 28, grow: 0, hAlign: 'start', marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: 'middle' } };
        } else if (childType === 'box') {
          newChild = { type: 'box', props: { direction: 'row' }, children: [] };
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
    var json = JSON.stringify(stripInternalProps(elements), null, 2);
    navigator.clipboard.writeText(json).then(function() { setStatus('JSON copied'); });
  }

  function copyCode() {
    if (!elements) return;
    var NL = String.fromCharCode(10);
    var BT = String.fromCharCode(96);
    var DS = String.fromCharCode(36);
    var snippets = elements.map(function(el) {
      if (el.type === 'image' && Number(el.props.clipToCard)) {
        var p = el.props;
        return 'const bigLogoH = ' + p.height + ';' + NL
          + 'const [bigLogoSvg] = renderSuffixLogo("' + p.suffix + '", ' + p.anchorX + ', ' + p.anchorY + ', bigLogoH);' + NL
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

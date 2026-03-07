#!/usr/bin/env python3
"""Generate an HTML gallery of pokeproxy SVG outputs for all card types.

Picks one representative card per template type, runs each through
bridge.py, and writes an HTML file with inline SVGs for visual review.

Usage:
    cd pokeproxy
    python test_gallery.py            # render with source images
    python test_gallery.py --clean    # clean via ComfyUI first (server must be running)
    python test_gallery.py --open     # auto-open in browser after generation

    # Then open the output:
    open ../cache/test_gallery.html
"""

import argparse
import base64
import json
import os
import sys
import subprocess
import urllib.request
from pathlib import Path

POKEPROXY_DIR = Path(__file__).resolve().parent
CACHE = POKEPROXY_DIR.parent / "cache"
BRIDGE = POKEPROXY_DIR / "bridge.py"
VENV_PYTHON = POKEPROXY_DIR / ".venv" / "bin" / "python"
PYTHON = str(VENV_PYTHON) if VENV_PYTHON.exists() else sys.executable

SERVER_URL = os.environ.get("DECKLISTGEN_URL", "http://localhost:3001")

# Representative cards: (label, card_id, force_fullart)
# force_fullart=None means auto-detect from card data
TEST_CARDS = [
    # --- Standard Pokemon (white background, art window) ---
    ("PokemonBasic",         "sv01-001",    None),    # Pineco — common basic
    ("PokemonStage1",        "sv01-006",    None),    # Cacturne — ability + attack
    ("PokemonStage2",        "cel25-15",    None),    # Lunala — stage 2, holo rare
    # --- Full-art Pokemon (full-bleed art, overlay text) ---
    ("PokemonEX",            "sv01-019",    None),    # Spidops ex — double rare (auto-detected)
    ("PokemonEX Stage2",     "sv01-065",    None),    # Magnezone ex — stage 2 ex
    ("PokemonEX Ultra",      "sv01-231",    None),    # Koraidon ex — ultra rare
    ("PokemonV",             "cel25-16",    None),    # Zacian V — ability + attack
    ("PokemonVMAX",          "cel25-7",     None),    # Flying Pikachu VMAX
    ("Illustration Rare",    "sv01-207",    None),    # Dondozo — illustration rare
    # --- Trainers ---
    ("TrainerItem",          "sv01-172",    None),    # Energy Search
    ("TrainerSupporter",     "sv01-175",    None),    # Jacq
    ("TrainerStadium",       "sv03-196",    None),    # Town Store
    ("TrainerTool",          "sv02-173",    None),    # Bravery Charm
    ("Trainer FullArt",      "cel25-24",    None),    # Professor's Research (ultra rare)
    # --- Energy ---
    ("EnergyBasic",          "sv06.5-098",  None),    # Basic Darkness Energy
    ("EnergySpecial",        "sv09-190",    None),    # Spiky Energy
]


FULLART_RARITIES = [
    "illustration rare", "special illustration rare", "special art rare",
    "hyper rare", "art rare", "ultra rare", "secret rare",
    "amazing rare", "rare vmax", "rare vstar", "double rare",
]


def detect_fullart(card: dict) -> bool:
    """Mirror pokeproxy.is_fullart — all ex/V/VMAX/VSTAR + high rarity."""
    name = card.get("name", "")
    stage = card.get("stage", "")
    category = card.get("category", "")

    # All ex/EX Pokemon have full-bleed art
    if category == "Pokemon" and (
        name.lower().endswith(" ex")
        or stage in ("VMAX", "VSTAR")
        or card.get("suffix") in ("ex", "EX", "V", "VMAX", "VSTAR")
    ):
        return True

    # V cards
    if category == "Pokemon" and name.endswith(" V") and not name.endswith(" IV"):
        return True

    rarity = (card.get("rarity") or "").lower()
    if any(r in rarity for r in FULLART_RARITIES):
        return True

    official = (card.get("set") or {}).get("cardCount", {}).get("official", 999)
    local_id = card.get("localId", "0")
    try:
        if int(local_id) > official:
            return True
    except ValueError:
        pass
    return False


def download_image(card_id: str, card: dict) -> str | None:
    """Download card image from TCGdex if not cached. Returns base64 or None."""
    png_path = CACHE / f"{card_id}.png"
    if png_path.exists():
        return base64.b64encode(png_path.read_bytes()).decode()

    # Try to download from TCGdex
    image_url = card.get("image")
    if not image_url:
        set_id, local_id = card_id.rsplit("-", 1)
        image_url = f"https://assets.tcgdex.net/en/{set_id}/{local_id}/high.png"

    print(f"  Downloading {image_url}...")
    try:
        req = urllib.request.Request(image_url, headers={"User-Agent": "pokeproxy-test/1.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = resp.read()
        png_path.write_bytes(data)
        return base64.b64encode(data).decode()
    except Exception as e:
        print(f"  Failed to download: {e}")
        return None


def server_request(method: str, path: str, timeout: int = 10) -> dict | None:
    """Make a request to the decklistgen server. Returns parsed JSON or None."""
    url = f"{SERVER_URL}{path}"
    try:
        req = urllib.request.Request(url, method=method,
                                     headers={"User-Agent": "pokeproxy-test/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read())
    except Exception as e:
        print(f"  Server request failed ({method} {path}): {e}")
        return None


def clean_card(card_id: str) -> bool:
    """Request ComfyUI cleaning via the server. Returns True if clean image is available."""
    # Check if already cleaned
    clean_path = CACHE / f"{card_id}_clean.png"
    if clean_path.exists():
        print(f"  Already cleaned")
        return True

    print(f"  Requesting ComfyUI clean via server...")
    result = server_request("POST", f"/api/pokeproxy/generate/{card_id}", timeout=200)
    if result is None:
        return False

    status = result.get("status", "")
    if status in ("generated", "already_exists"):
        print(f"  Clean: {status}")
        return True
    else:
        print(f"  Clean failed: {result.get('error', status)}")
        return False


def get_best_image(card_id: str) -> str | None:
    """Get the best available image (composite > clean > source) as base64."""
    for suffix in ("_composite.png", "_clean.png", ".png"):
        path = CACHE / f"{card_id}{suffix}"
        if path.exists():
            return base64.b64encode(path.read_bytes()).decode()
    return None


def run_bridge(card: dict, image_b64: str, is_fullart: bool,
               has_clean: bool = False) -> str | None:
    """Run bridge.py and return SVG string."""
    payload = {
        "card": card,
        "image_base64": image_b64,
        "is_fullart": is_fullart,
        "options": {
            "overlay_opacity": 0.7,
            "max_cover": 0.55,
            "render_header": is_fullart and has_clean,
        },
    }
    try:
        result = subprocess.run(
            [PYTHON, str(BRIDGE)],
            input=json.dumps(payload),
            capture_output=True,
            text=True,
            timeout=30,
            cwd=str(BRIDGE.parent),
        )
        if result.returncode != 0:
            print(f"  bridge.py error: {result.stderr.strip()}")
            return None
        return result.stdout
    except subprocess.TimeoutExpired:
        print("  bridge.py timed out")
        return None


def check_server() -> bool:
    """Check if the decklistgen server is running."""
    try:
        req = urllib.request.Request(f"{SERVER_URL}/api/pokeproxy/status/test",
                                     headers={"User-Agent": "pokeproxy-test/1.0"})
        with urllib.request.urlopen(req, timeout=3):
            return True
    except Exception:
        return False


def generate_gallery(do_clean: bool = False):
    if do_clean:
        if not check_server():
            print(f"ERROR: Server not reachable at {SERVER_URL}")
            print("Start with: cd .. && bun run src/server/index.ts")
            sys.exit(1)
        print(f"Server OK at {SERVER_URL}\n")

    results = []

    for label, card_id, force_fullart in TEST_CARDS:
        print(f"[{label}] {card_id}...")

        # Load card JSON
        json_path = CACHE / f"{card_id}.json"
        if not json_path.exists():
            print(f"  Skipping — no cached JSON for {card_id}")
            results.append((label, card_id, None, "No card JSON"))
            continue

        card = json.loads(json_path.read_text())

        # Ensure source image exists
        src_b64 = download_image(card_id, card)
        if not src_b64:
            print(f"  Skipping — no image for {card_id}")
            results.append((label, card_id, None, "No image"))
            continue

        # Clean via ComfyUI if requested
        has_clean = False
        if do_clean:
            has_clean = clean_card(card_id)

        # Pick best available image for rendering
        image_b64 = get_best_image(card_id) or src_b64

        # Determine fullart
        is_fullart = force_fullart if force_fullart is not None else detect_fullart(card)

        # Run bridge
        svg = run_bridge(card, image_b64, is_fullart, has_clean=has_clean)
        if not svg:
            results.append((label, card_id, None, "Bridge failed"))
            continue

        # Get source image for preview (small enough for data URI)
        src_path = CACHE / f"{card_id}.png"
        src_data_uri = ""
        if src_path.exists():
            src_data_uri = f"data:image/png;base64,{base64.b64encode(src_path.read_bytes()).decode()}"

        card_name = card.get("name", card_id)
        card_info = {
            "category": card.get("category", "?"),
            "stage": card.get("stage", "-"),
            "rarity": card.get("rarity", "-"),
            "hp": card.get("hp", "-"),
            "types": card.get("types", []),
            "abilities": len(card.get("abilities") or []),
            "attacks": len(card.get("attacks") or []),
            "fullart": is_fullart,
            "cleaned": has_clean,
            "src_data_uri": src_data_uri,
        }
        results.append((label, card_id, svg, card_name, card_info))
        print(f"  OK — {card_name}")

    # Write HTML
    html = build_html(results, cleaned=do_clean)
    out_path = CACHE / "test_gallery.html"
    out_path.write_text(html)
    print(f"\nGallery written to {out_path}")
    return out_path


def build_html(results, cleaned=False):
    cards_html = []
    for entry in results:
        if len(entry) == 4:
            label, card_id, _, error = entry
            cards_html.append(f"""
        <div class="card error">
            <div class="label">{label}</div>
            <div class="card-id">{card_id}</div>
            <div class="error-msg">{error}</div>
        </div>""")
        else:
            label, card_id, svg, card_name, info = entry
            badges = []
            if info.get("cleaned"):
                badges.append('<span class="badge clean">CLEANED</span>')
            badges.append(f'<span class="badge {"fullart" if info["fullart"] else "standard"}">'
                          f'{"FULLART" if info["fullart"] else "STANDARD"}</span>')
            meta = " | ".join(filter(None, [
                info["category"],
                info["stage"] if info["stage"] != "-" else None,
                f"HP {info['hp']}" if info["hp"] != "-" else None,
                ", ".join(info["types"]) if info["types"] else None,
                f"{info['abilities']}ab/{info['attacks']}atk",
                info["rarity"],
            ]))
            # Unique id for this card's hidden source image
            uid = card_id.replace(".", "_").replace("-", "_")
            src_img = ""
            if info.get("src_data_uri"):
                src_img = f'<img class="hidden-src" id="src_{uid}" src="{info["src_data_uri"]}" />'
            cards_html.append(f"""
        <div class="card" data-card-id="{card_id}" data-uid="{uid}" onclick="showPreview('{uid}', this)" style="cursor:pointer">
            <div class="label">{label}</div>
            <div class="card-name">{card_name}</div>
            <div class="card-id">{card_id}</div>
            <div class="badges" id="badges_{uid}">{"".join(badges)}</div>
            <div class="meta">{meta}</div>
            <div class="svg-container" id="svg_{uid}">{svg}</div>
            {src_img}
        </div>""")

    mode_label = "with ComfyUI cleaning" if cleaned else "source images only"

    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Pokeproxy Test Gallery</title>
<style>
    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
    body {{
        background: #1a1a2e;
        color: #eee;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        padding: 24px;
    }}
    h1 {{
        text-align: center;
        margin-bottom: 4px;
        font-size: 24px;
        color: #fff;
    }}
    .subtitle {{
        text-align: center;
        color: #aaa;
        font-size: 13px;
        margin-bottom: 4px;
    }}
    .timestamp {{
        text-align: center;
        color: #666;
        font-size: 12px;
        margin-bottom: 24px;
    }}
    .gallery {{
        display: flex;
        flex-wrap: wrap;
        gap: 24px;
        justify-content: center;
    }}
    .card {{
        background: #16213e;
        border-radius: 12px;
        padding: 12px;
        width: 280px;
        display: flex;
        flex-direction: column;
        align-items: center;
    }}
    .card.error {{
        border: 2px solid #e74c3c;
        opacity: 0.6;
    }}
    .label {{
        font-weight: 700;
        font-size: 14px;
        color: #f39c12;
        margin-bottom: 4px;
    }}
    .card-name {{
        font-size: 15px;
        font-weight: 600;
        color: #fff;
    }}
    .card-id {{
        font-size: 12px;
        color: #888;
        margin-bottom: 4px;
    }}
    .badges {{
        display: flex;
        gap: 6px;
        margin-bottom: 4px;
    }}
    .badge {{
        font-size: 10px;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 4px;
        text-transform: uppercase;
    }}
    .badge.standard {{ background: #2d3748; color: #a0aec0; }}
    .badge.fullart {{ background: #553c9a; color: #d6bcfa; }}
    .badge.clean {{ background: #276749; color: #9ae6b4; }}
    .meta {{
        font-size: 11px;
        color: #aaa;
        text-align: center;
        margin-bottom: 8px;
        line-height: 1.4;
    }}
    .error-msg {{
        color: #e74c3c;
        font-size: 13px;
        padding: 20px;
    }}
    .svg-container {{
        width: 250px;
        height: 350px;
    }}
    .svg-container svg {{
        width: 100%;
        height: 100%;
    }}
    .hidden-src {{ display: none; }}
    /* Lightbox */
    .lightbox {{
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.85);
        z-index: 1000;
        justify-content: center;
        align-items: center;
        gap: 32px;
        padding: 40px;
    }}
    .lightbox.active {{ display: flex; }}
    .lightbox-panel {{
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
    }}
    .lightbox-panel-label {{
        font-size: 14px;
        font-weight: 700;
        color: #888;
        text-transform: uppercase;
        letter-spacing: 1px;
    }}
    .lightbox-panel img,
    .lightbox-panel .lightbox-svg {{
        height: 70vh;
        width: auto;
        border-radius: 12px;
        box-shadow: 0 4px 24px rgba(0,0,0,0.5);
    }}
    .lightbox-panel .lightbox-svg svg {{
        height: 70vh;
        width: auto;
        display: block;
    }}
    .lightbox-close {{
        position: fixed;
        top: 16px;
        right: 24px;
        font-size: 32px;
        color: #888;
        cursor: pointer;
        z-index: 1001;
        line-height: 1;
    }}
    .lightbox-close:hover {{ color: #fff; }}
    .lightbox-title {{
        position: fixed;
        top: 16px;
        left: 24px;
        font-size: 18px;
        font-weight: 700;
        color: #fff;
        z-index: 1001;
    }}
    .lightbox-actions {{
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        gap: 12px;
        z-index: 1001;
    }}
    .lightbox-actions button {{
        padding: 10px 20px;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
        transition: opacity 0.2s;
    }}
    .lightbox-actions button:hover {{ opacity: 0.85; }}
    .lightbox-actions button:disabled {{ opacity: 0.4; cursor: wait; }}
    .btn-clean {{ background: #276749; color: #9ae6b4; }}
    .btn-regen {{ background: #553c9a; color: #d6bcfa; }}
    .btn-force-clean {{ background: #9b2c2c; color: #fed7d7; }}
    .lightbox-status {{
        position: fixed;
        bottom: 72px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 13px;
        color: #aaa;
        z-index: 1001;
        text-align: center;
    }}
</style>
</head>
<body>
    <h1>Pokeproxy Test Gallery</h1>
    <div class="subtitle">{mode_label}</div>
    <div class="timestamp">{__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</div>
    <div class="gallery">
        {"".join(cards_html)}
    </div>
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
    const SERVER = '{SERVER_URL}';
    let currentCardId = null;
    let currentUid = null;

    function showPreview(uid, cardEl) {{
        const srcImg = document.getElementById('src_' + uid);
        const svgContainer = cardEl.querySelector('.svg-container');
        const title = cardEl.querySelector('.card-name')?.textContent || '';
        const label = cardEl.querySelector('.label')?.textContent || '';
        if (!srcImg || !svgContainer) return;
        currentCardId = cardEl.dataset.cardId;
        currentUid = uid;
        document.getElementById('lightbox-src').src = srcImg.src;
        document.getElementById('lightbox-svg').innerHTML = svgContainer.innerHTML;
        document.getElementById('lightbox-title').textContent = label + ' — ' + title;
        document.getElementById('lightbox-status').textContent = '';
        document.getElementById('lightbox').classList.add('active');
    }}

    function closeLightbox(e) {{
        if (e && e.target !== e.currentTarget && !e.target.classList.contains('lightbox-close')) return;
        document.getElementById('lightbox').classList.remove('active');
        currentCardId = null;
        currentUid = null;
    }}

    function setStatus(msg) {{
        document.getElementById('lightbox-status').textContent = msg;
    }}

    function setButtons(enabled) {{
        document.querySelectorAll('.lightbox-actions button').forEach(b => b.disabled = !enabled);
    }}

    async function doClean(force) {{
        if (!currentCardId) return;
        const cardId = currentCardId;
        setButtons(false);
        setStatus(force ? 'Force re-cleaning (random seed) via ComfyUI...' : 'Cleaning via ComfyUI...');
        try {{
            const url = SERVER + '/api/pokeproxy/generate/' + cardId + (force ? '?force=true' : '');
            const resp = await fetch(url, {{ method: 'POST' }});
            const data = await resp.json();
            if (data.status === 'generated' || data.status === 'already_exists') {{
                const seedInfo = data.seed != null ? ' (seed ' + data.seed + ')' : '';
                setStatus('Clean done' + seedInfo + '. Regenerating SVG...');
                await doRegenInner(cardId);
            }} else {{
                setStatus('Clean failed: ' + (data.error || data.status));
            }}
        }} catch (e) {{
            setStatus('Error: ' + e.message + ' — is the server running?');
        }}
        setButtons(true);
    }}

    async function doRegen() {{
        if (!currentCardId) return;
        setButtons(false);
        setStatus('Regenerating SVG...');
        try {{
            await doRegenInner(currentCardId);
        }} catch (e) {{
            setStatus('Error: ' + e.message);
        }}
        setButtons(true);
    }}

    async function doRegenInner(cardId) {{
        // Force-regenerate SVG on server
        const resp = await fetch(SERVER + '/api/pokeproxy/svg/' + cardId + '/regenerate', {{ method: 'POST' }});
        const data = await resp.json();
        if (data.status !== 'regenerated') {{
            setStatus('Regen failed: ' + (data.error || data.status));
            return;
        }}
        // Fetch fresh SVG
        const svgResp = await fetch(SERVER + '/api/pokeproxy/svg/' + cardId);
        if (!svgResp.ok) {{
            setStatus('Failed to fetch new SVG');
            return;
        }}
        const svgText = await svgResp.text();
        // Update lightbox
        document.getElementById('lightbox-svg').innerHTML = svgText;
        // Update gallery card too
        if (currentUid) {{
            const galleryContainer = document.getElementById('svg_' + currentUid);
            if (galleryContainer) galleryContainer.innerHTML = svgText;
            // Add/update CLEANED badge
            const badges = document.getElementById('badges_' + currentUid);
            if (badges && !badges.querySelector('.badge.clean')) {{
                badges.insertAdjacentHTML('afterbegin', '<span class="badge clean">CLEANED</span>');
            }}
        }}
        setStatus('Done — SVG updated');
    }}

    document.addEventListener('keydown', function(e) {{
        if (e.key === 'Escape') closeLightbox();
    }});
    </script>
</body>
</html>"""


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate pokeproxy test gallery")
    parser.add_argument("--clean", action="store_true",
                        help="Clean images via ComfyUI (server must be running)")
    parser.add_argument("--open", action="store_true",
                        help="Open gallery in browser after generation")
    parser.add_argument("--server", default=None,
                        help=f"Server URL (default: {SERVER_URL})")
    args = parser.parse_args()

    if args.server:
        SERVER_URL = args.server

    out_path = generate_gallery(do_clean=args.clean)

    if args.open:
        import platform
        if platform.system() == "Darwin":
            subprocess.run(["open", str(out_path)])
        elif platform.system() == "Linux":
            subprocess.run(["xdg-open", str(out_path)])
        else:
            print(f"Open manually: {out_path}")

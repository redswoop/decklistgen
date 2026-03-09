"""Pokemon TCG type icons using EssentiarumTCG font glyphs.

Renders energy type symbols as colored circles with white font glyphs.
Font embedded as base64 for SVG portability.
"""

import base64
import os

# Load font as base64 for SVG embedding
_FONT_PATH = os.path.join(os.path.dirname(__file__), "fonts", "EssentiarumTCG.otf")
with open(_FONT_PATH, "rb") as _f:
    _FONT_B64 = base64.b64encode(_f.read()).decode()

# Font-face CSS for SVG <defs> — call get_font_style() once per SVG document
_FONT_STYLE = (
    '<style>'
    '@font-face {'
    '  font-family: "EssentiarumTCG";'
    f'  src: url("data:font/otf;base64,{_FONT_B64}") format("opentype");'
    '}'
    '</style>'
)


def get_font_style() -> str:
    """Return the @font-face <style> block to include in SVG <defs>."""
    return _FONT_STYLE


# TCG type -> (font character, circle background color)
# Character mapping uses standard TCG type abbreviations:
#   G=Grass, R=Fire(Red), W=Water, L=Lightning, P=Psychic,
#   F=Fighting, D=Darkness, M=Metal, Y=Fairy, N=Dragon, C=Colorless
ICON_MAP = {
    "Grass":     {"char": "G", "bg": "#439837"},
    "Fire":      {"char": "R", "bg": "#e4613e"},
    "Water":     {"char": "W", "bg": "#3099e1"},
    "Lightning": {"char": "L", "bg": "#dfbc28"},
    "Psychic":   {"char": "P", "bg": "#e96c8c"},
    "Fighting":  {"char": "F", "bg": "#e49021"},
    "Darkness":  {"char": "D", "bg": "#4f4747"},
    "Metal":     {"char": "M", "bg": "#74b0cb"},
    "Fairy":     {"char": "Y", "bg": "#e18ce1"},
    "Dragon":    {"char": "N", "bg": "#576fbc"},
    "Colorless": {"char": "C", "bg": "#828282"},
}

# Single-letter abbreviation aliases
_ABBREV_MAP = {
    "G": "Grass", "R": "Fire", "W": "Water", "L": "Lightning",
    "P": "Psychic", "F": "Fighting", "D": "Darkness", "M": "Metal",
    "Y": "Fairy", "N": "Dragon", "C": "Colorless",
}
for _abbrev, _name in _ABBREV_MAP.items():
    ICON_MAP[_abbrev] = ICON_MAP[_name]

# Dragon SVG path fallback (N renders "LEGEND" text in the font)
_DRAGON_PATHS = (
    '<path fill="#fff" d="M170.93,124.41c.8,15.21-5.05,28.07-14.96,38.95-4.86,5.34-7.13,10.82-7.01,17.85.07,4.3-.64,8.63-1.21,12.91-1.48,11.17-7.97,16.55-19.79,16.53-11.81-.02-18.2-5.38-19.75-16.59-.18-1.32-.43-2.65-.42-3.97.07-12.31-3.37-22.68-11.93-32.43-14.25-16.22-14.56-45.3-2.66-60.49,5.82-7.42,4.65-17.14,7.55-25.58,2.37-6.9,4.02-14.05,6.07-21.06,.48-1.65,1.51-3.06,3.48-3,2.02,.06,2.71,1.6,3.11,3.3,1.8,7.77,4.05,15.47,5.23,23.33,.95,6.31,4.94,5.95,9.39,5.97,4.5,.02,8.42,.25,9.35-6.03,1.11-7.53,3.32-14.9,5.03-22.34,.45-1.96,.74-4.19,3.34-4.19,2.43,0,3.15,1.99,3.71,4,1.88,6.72,3.88,13.4,5.7,20.14,3.01,11.13,4.22,22.74,11.59,32.51,4.31,5.71,3.98,13.22,4.18,20.21Z"/>'
    '<path fill="#fff" d="M194.2,95.93c16.78,17.37,18.87,64.53-8.22,85.49-5.83-6.35-8.44-14.77-13.52-21.58-.65-.87-.74-2.88-.18-3.82,5.41-9,4.95-20.46,12.96-28.54,7.84-7.92,9.39-18.61,8.97-31.55Z"/>'
    '<path fill="#576fbc" d="M141.47,153.95c6.61-10.7,12.32-19.93,18.62-30.12,5.76,18.39-.34,28.8-18.62,30.12Z"/>'
    '<path fill="#fff" d="M61.68,95.93c-16.78,17.37-18.87,64.53,8.22,85.49,5.83-6.35,8.44-14.77,13.52-21.58,.65-.87,.74-2.88,.18-3.82-5.41-9-4.95-20.46-12.96-28.54-7.84-7.92-9.39-18.61-8.97-31.55Z"/>'
    '<path fill="#576fbc" d="M115.46,153.95c-6.61-10.7-12.32-19.93-18.62-30.12-5.76,18.39,.34,28.8,18.62,30.12Z"/>'
)


_icon_id_counter = 0


def _next_icon_id():
    global _icon_id_counter
    _icon_id_counter += 1
    return f"ei{_icon_id_counter}"


def _glassy_circle(cx, cy, radius, bg_color, uid):
    """Render a glassy/glossy circle like official TCG energy dots.
    Uses radial gradient base + upper highlight crescent + rim lighting."""
    r = radius
    return (
        # Defs: radial gradient (lighter center → darker edge) + gloss highlight
        f'<defs>'
        f'<radialGradient id="{uid}-rg" cx="45%" cy="40%" r="55%">'
        f'  <stop offset="0%" stop-color="#fff" stop-opacity="0.35"/>'
        f'  <stop offset="60%" stop-color="{bg_color}" stop-opacity="0"/>'
        f'  <stop offset="100%" stop-color="#000" stop-opacity="0.3"/>'
        f'</radialGradient>'
        f'<radialGradient id="{uid}-gl" cx="50%" cy="25%" r="50%">'
        f'  <stop offset="0%" stop-color="#fff" stop-opacity="0.55"/>'
        f'  <stop offset="50%" stop-color="#fff" stop-opacity="0.12"/>'
        f'  <stop offset="100%" stop-color="#fff" stop-opacity="0"/>'
        f'</radialGradient>'
        f'<clipPath id="{uid}-cp"><circle cx="{cx}" cy="{cy}" r="{r}"/></clipPath>'
        f'</defs>'
        # Base color circle
        f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{bg_color}"/>'
        # Radial gradient overlay: lighter center, darker rim
        f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="url(#{uid}-rg)"/>'
        # Upper gloss highlight: soft white ellipse near the top
        f'<ellipse cx="{cx}" cy="{cy - r * 0.2:.0f}" rx="{r * 0.7:.0f}" ry="{r * 0.55:.0f}" '
        f'fill="url(#{uid}-gl)" clip-path="url(#{uid}-cp)"/>'
        # Rim: thin dark border with slight inner light edge
        f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="#000" stroke-width="{max(1, r * 0.08):.1f}" opacity="0.5"/>'
        f'<circle cx="{cx}" cy="{cy}" r="{r - max(1, r * 0.06):.1f}" fill="none" stroke="#fff" stroke-width="{max(0.5, r * 0.04):.1f}" opacity="0.15"/>'
    )


def render_type_icon(cx: float, cy: float, radius: float, type_name: str) -> str:
    """Render a type icon centered at (cx, cy) with given radius.
    Returns SVG markup string. Falls back to a gray circle for unknown types."""
    icon = ICON_MAP.get(type_name)
    uid = _next_icon_id()
    if not icon:
        return (
            f'{_glassy_circle(cx, cy, radius, "#888", uid)}'
            f'<text x="{cx}" y="{int(cy + 1)}" font-family="Helvetica, Arial, sans-serif" '
            f'font-size="{int(radius * 1.3)}" font-weight="bold" fill="white" '
            f'text-anchor="middle" dominant-baseline="central">?</text>'
        )

    bg = icon["bg"]
    char = icon["char"]

    # Dragon: use SVG path fallback since 'N' renders "LEGEND" in the font
    if type_name in ("Dragon", "N"):
        scale = (radius * 2) / 256
        tx = cx - radius
        ty = cy - radius
        return (
            f'{_glassy_circle(cx, cy, radius, bg, uid)}'
            f'<g transform="translate({tx:.1f},{ty:.1f}) scale({scale:.4f})" clip-path="url(#{uid}-cp)">'
            f'{_DRAGON_PATHS}'
            f'</g>'
        )

    font_size = radius * 1.55
    sw = max(1, radius * 0.08)
    return (
        f'{_glassy_circle(cx, cy, radius, bg, uid)}'
        f'<text x="{cx}" y="{cy}" font-family="EssentiarumTCG" '
        f'font-size="{font_size:.0f}" fill="#111" '
        f'stroke="#fff" stroke-width="{sw:.1f}" stroke-linejoin="round" '
        f'style="paint-order:stroke fill" '
        f'text-anchor="middle" dominant-baseline="central">{char}</text>'
    )

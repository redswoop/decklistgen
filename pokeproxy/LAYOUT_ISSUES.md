# Pokeproxy Layout Issues

Design review of SVG card templates. Issues ranked by severity.
Priority fixes marked with `[!!!]`.

---

## Layout & Spacing

### 1. [!!!] Footer overflow risk (both templates)
**File:** `pokeproxy.py:480-522`
Weakness/resistance/retreat icons render left-to-right with fixed spacing
(`footer_x += body_size * 2.5`). Cards with all three (e.g. Psychic: weakness +
resistance + retreat) can overflow the 750px card width. Spacing is based on
`body_size`, not measured text width.

**Fix:** Measure actual content width, then either compress spacing or split
into two rows when total exceeds available width.

### 2. No page-break control in print layout
**File:** `pokeproxy.py:1364-1416`
Print HTML uses flexbox wrap with `page-break-inside: avoid` per card but no
`page-break-after` every 9 cards (3x3 on letter). Partial rows split across
pages, wasting paper.

**Fix:** Add a page-break element after every 9th card div.

### 3. Content can overrun footer zone (standard template)
**File:** `pokeproxy.py:1329`
Footer hardcoded at `y = CARD_H - 60` regardless of content cursor position.
Heavy text at BODY_SMALL (28px) can bleed into footer/separator area.

**Fix:** Clamp content cursor to stop above footer, or push footer down and
accept overflow as a conscious tradeoff.

### 4. Fixed header-to-subtitle spacing (standard template)
**File:** `pokeproxy.py:1098,1162`
Name at `y=57`, subtitle at `y=105` are fixed. When name shrinks via
`fit_name_size`, the gap looks too loose.

**Fix:** Derive subtitle y from actual name size.

### 5. Fullart header gradient too short for evolveFrom
**File:** `pokeproxy.py:790,914-915`
Header gradient is 140px but evolveFrom renders at y=86. Long suffixed name +
evolveFrom can extend below gradient, leaving text over raw art with poor
contrast.

**Fix:** Extend header gradient height when evolveFrom is present.

---

## Visual Consistency

### 6. Name suffix unstyled in standard template
**File:** `pokeproxy.py:1098`
Standard template renders "Charizard ex" as plain white text. Fullart template
splits into base name + gradient-styled suffix with emboss (lines 882-906).

**Fix:** Apply suffix styling in both templates.

### 7. HP format inconsistency
**File:** `pokeproxy.py:1152`
Standard card: `"280 HP"` (number then label). Fullart: HP number large with
small "HP" prefix above-left. Real TCG cards use "HP" as prefix.

**Fix:** Unify to prefix format in both templates.

### 8. Attack damage color mismatch
Standard: `fill="#c00"` (line 1302). Fullart: `fill="#FF5533"` (line 980).

**Fix:** Use the same damage color in both templates.

### 9. Inline energy symbols vs attack cost icons
**File:** `pokeproxy.py:442-455`
Effect text energy refs ({D}, {W}) render as plain colored Unicode circles.
Attack cost dots use full `render_type_icon` with glossy circles + font glyphs.
Two visually different treatments for the same concept.

**Fix:** Use EssentiarumTCG glyphs for inline energy too, or at minimum match
the color/style more closely.

### 10. [!!!] Ability bar contrast too low (standard template)
**File:** `pokeproxy.py:1267`
Ability bar uses `opacity="0.25"` on white background — very faint. Fullart
uses `opacity="0.75"`. Ability section barely stands out from attack section.

**Fix:** Raise standard ability bar opacity to ~0.4-0.5.

---

## Print & Production

### 11. No bleed margin
Both templates render at exactly 750x1050 (2.5" x 3.5"). No bleed area — any
cutting error exposes raw edge.

**Fix:** Add 2-3mm bleed by extending backgrounds/borders beyond the trim line,
or add a full-bleed colored border.

### 12. [!!!] Drop shadows on dark-on-light text (standard template)
**File:** `pokeproxy.py:1255,1275,1310`
Body text (`fill="#222"`) on white background gets `filter="url(#shadow)"`.
Drop shadows on dark text over light backgrounds look muddy at print size.

**Fix:** Remove shadow filter from body text in standard template. Keep it for
fullart (white-on-dark) only.

### 13. Artwork clip-path uses CSS shorthand (standard template)
**File:** `pokeproxy.py:1244`
`clip-path="inset(0 round 10px)"` is CSS, not native SVG. Works in browsers
but may fail in standalone SVG renderers (Inkscape, librsvg, print RIPs).

**Fix:** Use a proper `<clipPath>` element like the fullart template does.

---

## Minor

### 14. Dead parameter `render_header`
**File:** `pokeproxy.py:617`
`generate_fullart_svg` accepts `render_header: bool = False` but never uses it.

### 15. Filter ID collisions across templates
Standard and fullart both define `#shadow` with different parameters. Embedding
both SVGs in one HTML document causes last-defined filter to win.

**Fix:** Namespace filter IDs per template (e.g. `#std-shadow`, `#fa-shadow`).

### 16. Retreat icon is non-standard
**File:** `pokeproxy.py:516-518`
Retreat shown as right-pointing triangle + line. Real TCG cards show retreat as
Colorless energy dots. The arrow reads as "play" not "retreat."

**Fix:** Remove the arrow, just show Colorless dots (which are already rendered
after the arrow).

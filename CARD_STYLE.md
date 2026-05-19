# Card Style

Visual conventions for DecklistGen's rendered Pokemon proxy cards.

## Why visual quality is the bar

The point of this project is cards that look like authentic Pokemon TCG cards. Visual polish isn't optional polish on top of a "working" system — it *is* the system. A functional decklist tool whose proxies look amateurish defeats the purpose.

Implications:

- When a card looks "wonky," "off," or "lacking," treat it as a first-class problem with ambitious scope. Don't reach for the smallest possible patch.
- Reference real Pokemon TCG cards as the source of truth on layout, spacing, typography, and hierarchy decisions. Faithfulness to the real cards is the north star.
- Aesthetic decisions are conversations, not specs. Riff on them, propose options, look at real examples — don't ship to a checklist.

## Template editing — vertical alignment

JSON card templates live in `data/templates/`. When you modify any element in a template, walk every nearby element's vertical-axis properties before declaring the work done.

For every element you add or change, trace `anchorY`, `vAlign`, `vAnchor`, `marginTop`/`marginBottom`, `paddingTop`/`paddingBottom` against any sibling or parallel element it's meant to align with.

When one element is meant to *back* another (e.g. a plate behind a name, a ribbon behind an attack), prefer making the visible content a **child** of the styled container, not a parallel element sized by a phantom mirror. Phantom-sizing drifts: the phantom's bounding box won't track changes to the real element's contents or layout properties.

Cross-check against related templates (`pokemon-fullart.json`, `pokemon-vstar.json`, `pokemon-standard.json`, `trainer.json`) for shared conventions — see [Template Conventions in CLAUDE.md](./CLAUDE.md#template-conventions) for the anchor/radius/padding norms.

Never declare a template change visually correct from JSON inspection alone. Render samples through the `/gallery/` page (or via the `render_proxy_svg` MCP tool) and look at them. If you reviewed only one axis (horizontal but not vertical, or vice versa), say so explicitly.

## Concrete past failure

A `name-plate` rectangle was placed behind the Pokemon name where the plate's bounding box (anchorY=30, phantom child mirroring `_baseName`) did not match the actual name-cluster's bounding box (anchorY=46, vAlign:bottom, marginBottom:6). The plate also failed to extend under the "ex" suffix logo because the phantom child mirrored only `_baseName`, not the full name-cluster contents. Static review of vAlign / anchorY / padding / margin against the parallel cluster would have caught this before shipping.

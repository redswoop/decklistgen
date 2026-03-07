#!/usr/bin/env python3
"""Bridge for subprocess communication with decklistgen.

Reads JSON from stdin, calls the appropriate renderer, writes SVG to stdout.

Protocol:
  Input (JSON on stdin):
    {
      "card": { ... TCGdex card data ... },
      "image_base64": "...",
      "is_fullart": true/false,
      "options": {
        "overlay_opacity": 0.7,
        "font_size": null,
        "max_cover": 0.55,
        "render_header": false
      }
    }

  Output: SVG string on stdout
  Errors: printed to stderr, exit code 1
"""

import base64
import json
import sys

from pokeproxy import crop_artwork, generate_svg, generate_fullart_svg


def main():
    try:
        data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        print(f"Invalid JSON input: {e}", file=sys.stderr)
        sys.exit(1)

    card = data.get("card")
    image_b64 = data.get("image_base64", "")
    is_fullart = data.get("is_fullart", False)
    options = data.get("options", {})

    if not card:
        print("Missing 'card' in input", file=sys.stderr)
        sys.exit(1)

    if is_fullart:
        svg = generate_fullart_svg(
            card,
            image_b64,
            overlay_opacity=options.get("overlay_opacity", 0.7),
            font_size=options.get("font_size"),
            max_cover=options.get("max_cover", 0.55),
            render_header=options.get("render_header", False),
        )
    else:
        # Decode image, crop artwork, then render
        image_bytes = base64.b64decode(image_b64)
        artwork_b64 = crop_artwork(image_bytes)
        svg = generate_svg(card, artwork_b64)

    sys.stdout.write(svg)


if __name__ == "__main__":
    main()

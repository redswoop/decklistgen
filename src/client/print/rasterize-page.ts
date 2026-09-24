import { toCanvas } from "html-to-image";
import { withPngDpi } from "../../shared/utils/png-dpi.js";

/**
 * Rasterize one print page's card grid to a PNG for Bambu Suite's Print Then
 * Cut: cards opaque, gutters and corners transparent, so Suite can print it
 * on the paper printer (with its own registration markers) and derive the cut
 * contour from the alpha edge. Stamped with a pHYs chunk so it imports at
 * real size.
 *
 * Runs entirely in the browser: html-to-image serialises the live DOM (fonts
 * are same-origin, cleaned art is same-origin, tcgdex originals send CORS *)
 * and we clip the result to rounded rects taken from the actual cell boxes.
 */

const CSS_PX_PER_IN = 96;
const MM_PER_IN = 25.4;

export interface RasterizeOptions {
  dpi: number;
  /** Card corner radius, mm. */
  cornerMm: number;
  /** Selector for the cells inside the grid; each becomes one opaque island. */
  cellSelector?: string;
}

export interface RasterizedPage {
  blob: Blob;
  widthPx: number;
  heightPx: number;
  cells: number;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

export async function rasterizePage(grid: HTMLElement, opts: RasterizeOptions): Promise<RasterizedPage> {
  const ratio = opts.dpi / CSS_PX_PER_IN;
  const cellSelector = opts.cellSelector ?? ".print-cell";

  // Cell boxes relative to the grid, in CSS px, before we touch anything.
  const gridBox = grid.getBoundingClientRect();
  const cells = Array.from(grid.querySelectorAll<HTMLElement>(cellSelector)).map((el) => {
    const b = el.getBoundingClientRect();
    return { x: b.left - gridBox.left, y: b.top - gridBox.top, w: b.width, h: b.height };
  });
  if (cells.length === 0) throw new Error("no cells to rasterize");

  const src = await toCanvas(grid, {
    pixelRatio: ratio,
    cacheBust: false,
    // Keep the grid's own (transparent) background; cards paint their own.
    backgroundColor: undefined,
  });

  const widthPx = Math.round(gridBox.width * ratio);
  const heightPx = Math.round(gridBox.height * ratio);
  const out = document.createElement("canvas");
  out.width = widthPx;
  out.height = heightPx;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");

  const rPx = (opts.cornerMm / MM_PER_IN) * CSS_PX_PER_IN * ratio;
  ctx.beginPath();
  for (const c of cells) roundedRect(ctx, c.x * ratio, c.y * ratio, c.w * ratio, c.h * ratio, rPx);
  ctx.clip();
  ctx.drawImage(src, 0, 0, widthPx, heightPx);

  const raw = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, "image/png"));
  if (!raw) throw new Error("toBlob failed");
  const stamped = withPngDpi(new Uint8Array(await raw.arrayBuffer()), opts.dpi);
  return { blob: new Blob([stamped], { type: "image/png" }), widthPx, heightPx, cells: cells.length };
}

export function pagePngFilename(page: number, pages: number, cols: number, rows: number, dpi: number): string {
  return `print-page-${page}-of-${pages}-${cols}x${rows}-${dpi}dpi.png`;
}

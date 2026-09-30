import {
  CRICUT_LAYOUT,
  cricutSheetPx,
  cricutSlotPx,
  cricutPdfMatrix,
  cricutCutLine,
  cricutCardsPerRegion,
  type CricutLayout,
  type CricutRegion,
} from "../../shared/utils/print-cricut-layout.js";
import { buildPdf, type PdfImagePage } from "../../shared/utils/pdf-image-pages.js";
import { withPngDpi } from "../../shared/utils/png-dpi.js";

/**
 * Compose Design Space's Letter print raster ourselves: its registration marks
 * (pixel copy), our cards at the slots it uses, a bleed ring like its own, on
 * white. Then wrap the pages in a lossless PDF and stamp out the one-time cut
 * fixture. Browser-only (canvas + CompressionStream); the geometry lives in
 * print-cricut-layout.ts and the PDF bytes in pdf-image-pages.ts, both tested.
 */

const MM_PER_IN = 25.4;

export function loadMarks(layout: CricutLayout = CRICUT_LAYOUT): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${layout.marksAsset}`));
    img.src = layout.marksAsset;
  });
}

/**
 * Turn a portrait card canvas a quarter turn counter-clockwise (top edge to the
 * left), the way Design Space printed the 6-up sheet. Portrait `w × h` → `h × w`.
 */
export function toLandscape(portrait: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = portrait.height;
  out.height = portrait.width;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  ctx.translate(0, out.height);
  ctx.rotate(-Math.PI / 2);
  ctx.drawImage(portrait, 0, 0);
  return out;
}

/** Average colour a few px inside the middle of each edge: the card border. */
function edgeColour(card: HTMLCanvasElement): string {
  const ctx = card.getContext("2d");
  if (!ctx) return "#ffffff";
  const inset = 6;
  const probes = [
    [card.width / 2, inset],
    [card.width / 2, card.height - inset],
    [inset, card.height / 2],
    [card.width - inset, card.height / 2],
  ];
  let r = 0, g = 0, b = 0, n = 0;
  for (const [x, y] of probes) {
    const d = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
    if (d[3] < 200) continue;
    r += d[0]; g += d[1]; b += d[2]; n++;
  }
  if (n === 0) return "#ffffff";
  return `rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})`;
}

/**
 * Draw one card with a bleed ring: a border-coloured rectangle fills the ring
 * (and the rounded-corner gaps, as Design Space's edge extension does), offset
 * copies of the card smear its real edge pixels outward, then the card itself
 * lands on top so nothing inside the cut line changes.
 */
function drawCardWithBleed(ctx: CanvasRenderingContext2D, card: HTMLCanvasElement, x: number, y: number, bleed: number) {
  ctx.save();
  ctx.fillStyle = edgeColour(card);
  ctx.fillRect(x - bleed, y - bleed, card.width + 2 * bleed, card.height + 2 * bleed);
  const steps = 16;
  for (const radius of [bleed, bleed / 2]) {
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      ctx.drawImage(card, Math.round(x + Math.cos(a) * radius), Math.round(y + Math.sin(a) * radius));
    }
  }
  ctx.drawImage(card, x, y);
  ctx.restore();
}

/**
 * One region's raster: white, Design Space's marks, up to cols×rows cards
 * (null = empty slot). Card canvases must already be landscape `cardW × cardH`.
 */
export function composeCricutPage(
  cards: (HTMLCanvasElement | null)[],
  marks: HTMLImageElement,
  layout: CricutLayout = CRICUT_LAYOUT,
): HTMLCanvasElement {
  const page = document.createElement("canvas");
  page.width = layout.rasterW;
  page.height = layout.rasterH;
  const ctx = page.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, page.width, page.height);
  ctx.drawImage(marks, 0, 0);
  cards.forEach((card, i) => {
    if (!card) return;
    if (card.width !== layout.cardW || card.height !== layout.cardH) {
      throw new Error(`card ${i} is ${card.width}×${card.height}, expected ${layout.cardW}×${layout.cardH}`);
    }
    const { x, y } = cricutSlotPx(i, layout);
    drawCardWithBleed(ctx, card, x, y, layout.bleed);
  });
  return page;
}

/** zlib-wrapped deflate, which is what /FlateDecode wants. */
export async function deflateZlib(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Strip alpha: the page is opaque white underneath, so RGB is lossless here. */
export function canvasToRgb(canvas: HTMLCanvasElement): Uint8Array {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const rgb = new Uint8Array(canvas.width * canvas.height * 3);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
    rgb[j] = data[i];
    rgb[j + 1] = data[i + 1];
    rgb[j + 2] = data[i + 2];
  }
  return rgb;
}

export async function pageToPdfImage(canvas: HTMLCanvasElement): Promise<PdfImagePage> {
  return { width: canvas.width, height: canvas.height, deflated: await deflateZlib(canvasToRgb(canvas)) };
}

/** One printed page: a raster per region that holds cards. */
export type CricutPdfPage = { region: CricutRegion; image: PdfImagePage }[];

export function buildCricutPdf(pages: CricutPdfPage[], liftMm: number, layout: CricutLayout = CRICUT_LAYOUT): Blob {
  const cut = cricutCutLine(layout);
  const bytes = buildPdf(
    pages.map((rasters) => ({
      lines: cut ? [cut] : [],
      pageWPt: layout.pageWPt,
      pageHPt: layout.pageHPt,
      images: rasters.map(({ region, image }) => ({ image, matrix: cricutPdfMatrix(region, liftMm, layout) })),
    })),
  );
  return new Blob([bytes], { type: "application/pdf" });
}

/**
 * The image Design Space holds so its cut job matches every printed page:
 * the sheet at exact size with one opaque rounded island per slot. Upload it
 * once, set its width to the value in the filename, never move it.
 */
export async function cricutFixturePng(layout: CricutLayout = CRICUT_LAYOUT): Promise<Blob> {
  const { w, h } = cricutSheetPx(layout);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  const r = (layout.cornerMm / MM_PER_IN) * layout.dpi;
  const slots = cricutCardsPerRegion(layout);
  for (let i = 0; i < slots; i++) {
    const { x, y } = cricutSlotPx(i, layout);
    const sx = x - layout.sheetX;
    const sy = y - layout.sheetY;
    ctx.fillStyle = "#6b7a90";
    ctx.beginPath();
    ctx.roundRect(sx, sy, layout.cardW, layout.cardH, r);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${Math.round(layout.dpi * 0.16)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`DecklistGen cut fixture ${i + 1}/${slots}`, sx + layout.cardW / 2, sy + layout.cardH / 2 - layout.dpi * 0.12);
    ctx.font = `${Math.round(layout.dpi * 0.12)}px sans-serif`;
    ctx.fillText("Set width in the filename · never move", sx + layout.cardW / 2, sy + layout.cardH / 2 + layout.dpi * 0.12);
  }
  const raw = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!raw) throw new Error("toBlob failed");
  const stamped = withPngDpi(new Uint8Array(await raw.arrayBuffer()), layout.dpi);
  return new Blob([stamped], { type: "image/png" });
}

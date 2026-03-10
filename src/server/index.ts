import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import setsRouter from "./routes/sets.js";
import cardsRouter from "./routes/cards.js";
import decklistRouter from "./routes/decklist.js";
import decksRouter from "./routes/decks.js";
import proxyRouter from "./routes/proxy.js";
import galleryRouter from "./routes/gallery.js";
import devLayoutRouter from "./routes/dev-layout.js";
import { logAccess, getClientIp } from "./services/logger.js";

const app = new Hono();

app.use("*", cors());

app.use("*", async (c, next) => {
  const start = Date.now();
  await next();
  logAccess({
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    ms: Date.now() - start,
    ip: getClientIp(c),
    ua: c.req.header("user-agent") ?? "",
  });
});

// API routes
app.route("/api/sets", setsRouter);
app.route("/api/cards", cardsRouter);
app.route("/api/decklist", decklistRouter);
app.route("/api/decks", decksRouter);
app.route("/api/pokeproxy", proxyRouter);
app.route("/gallery", galleryRouter);
app.route("/dev/layout", devLayoutRouter);

// In production, serve static files
app.use("/*", serveStatic({ root: "./dist/client" }));

const port = parseInt(process.env.PORT ?? "3001", 10);
console.log(`DecklistGen server listening on :${port}`);

export default {
  port,
  fetch: app.fetch,
  idleTimeout: 255, // seconds — ComfyUI jobs can take minutes
};

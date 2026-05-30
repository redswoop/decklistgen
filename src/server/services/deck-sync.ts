import type { DeckSummary, SavedDeck } from "../../shared/types/deck.js";

const REQUEST_TIMEOUT_MS = 10_000;

export class RemoteSyncError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "RemoteSyncError";
  }
}

/**
 * Normalize a user-typed server URL. Strips trailing slash, prepends `https://`
 * if no protocol is present, and validates that the result is a well-formed URL.
 * Rejects URLs that point at this very server (host:port match) to avoid
 * accidental self-sync loops.
 */
export function normalizeServerUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new RemoteSyncError("Server URL is required", 400);

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new RemoteSyncError(`Invalid server URL: ${input}`, 400);
  }

  const ownPort = process.env.PORT ?? "3001";
  const localHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::1]"]);
  if (localHosts.has(parsed.hostname) && (parsed.port === ownPort || parsed.port === "")) {
    throw new RemoteSyncError("Cannot sync from this server to itself", 400);
  }

  // Re-serialize, dropping trailing slash on the pathname-less root.
  const base = `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  return base.replace(/\/+$/, "");
}

/**
 * Extract just the `session=…` value from a Set-Cookie header. Hono's auth
 * endpoint sets a single cookie named `session`; the rest of the attributes
 * (Path, HttpOnly, etc.) are server-directives we shouldn't echo back.
 */
export function parseSessionCookie(setCookieHeader: string | null): string | null {
  if (!setCookieHeader) return null;
  const match = setCookieHeader.match(/(?:^|,\s*)session=([^;,\s]+)/);
  return match ? `session=${match[1]}` : null;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes("aborted") || message.includes("timeout")) {
      throw new RemoteSyncError(`Remote server did not respond within ${REQUEST_TIMEOUT_MS / 1000}s`, 504);
    }
    throw new RemoteSyncError(`Could not reach remote server: ${message}`, 502);
  }
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json() as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Log into the remote server and return the captured session cookie.
 * Used by both fetchRemoteDeckSummaries and importRemoteDecks.
 */
export async function loginRemote(url: string, email: string, password: string): Promise<string> {
  const res = await fetchWithTimeout(`${url}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    throw new RemoteSyncError(await readError(res, "Login failed"), res.status);
  }

  const cookie = parseSessionCookie(res.headers.get("set-cookie"));
  if (!cookie) {
    throw new RemoteSyncError("Remote did not return a session cookie", 502);
  }
  return cookie;
}

export async function fetchRemoteDeckSummaries(
  url: string,
  email: string,
  password: string,
): Promise<{ summaries: DeckSummary[]; sessionCookie: string }> {
  const sessionCookie = await loginRemote(url, email, password);
  const res = await fetchWithTimeout(`${url}/api/decks`, {
    headers: { cookie: sessionCookie },
  });
  if (!res.ok) {
    throw new RemoteSyncError(await readError(res, "Failed to list remote decks"), res.status);
  }
  const summaries = await res.json() as DeckSummary[];
  return { summaries, sessionCookie };
}

export async function fetchRemoteDeck(
  url: string,
  sessionCookie: string,
  deckId: string,
): Promise<SavedDeck> {
  const res = await fetchWithTimeout(`${url}/api/decks/${encodeURIComponent(deckId)}`, {
    headers: { cookie: sessionCookie },
  });
  if (!res.ok) {
    throw new RemoteSyncError(await readError(res, `Failed to fetch deck ${deckId}`), res.status);
  }
  return await res.json() as SavedDeck;
}

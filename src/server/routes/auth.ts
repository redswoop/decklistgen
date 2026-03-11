import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { createUser, findUserByEmail, findUserById, verifyPassword, getUserCount, createUserWithoutPassword, setPassword } from "../services/user-store.js";
import { createSession, deleteSession } from "../services/session-store.js";
import { findMagicLink, redeemMagicLink } from "../services/magic-link-store.js";
import type { AppEnv } from "../types.js";

const app = new Hono<AppEnv>();

const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

function setSessionCookie(c: Parameters<typeof setCookie>[0], sessionId: string) {
  const secure = process.env.NODE_ENV === "production" || process.env.SECURE_COOKIES === "1";
  setCookie(c, "session", sessionId, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    ...(secure ? { secure: true } : {}),
  });
}

/** First-user bootstrap — only works when no users exist */
app.post("/setup", async (c) => {
  if (getUserCount() > 0) {
    return c.json({ error: "Setup already completed" }, 403);
  }

  const { email, password, displayName } = await c.req.json<{
    email: string;
    password: string;
    displayName: string;
  }>();

  if (!email?.trim() || !password || !displayName?.trim()) {
    return c.json({ error: "Email, password, and display name are required" }, 400);
  }
  if (password.length < 8) {
    return c.json({ error: "Password must be at least 8 characters" }, 400);
  }

  const user = await createUser({ email, password, displayName, isAdmin: true, isAuthorized: true });
  const session = createSession(user.id);
  setSessionCookie(c, session.id);

  return c.json(user, 201);
});

/** Validate a magic link token (check if it's valid without redeeming) */
app.get("/magic/:token", (c) => {
  const token = c.req.param("token");
  const link = findMagicLink(token);

  if (!link) return c.json({ error: "Invalid link" }, 404);
  if (link.usedAt) return c.json({ error: "Link already used" }, 410);
  if (new Date(link.expiresAt) < new Date()) return c.json({ error: "Link expired" }, 410);

  return c.json({
    email: link.email,
    displayName: link.displayName,
  });
});

/** Redeem a magic link — set password and create account */
app.post("/magic/:token", async (c) => {
  const token = c.req.param("token");
  const { password } = await c.req.json<{ password: string }>();

  if (!password || password.length < 8) {
    return c.json({ error: "Password must be at least 8 characters" }, 400);
  }

  const link = redeemMagicLink(token);
  if (!link) return c.json({ error: "Invalid, expired, or already used link" }, 400);

  // Check if a user with this email already exists
  const existing = findUserByEmail(link.email);
  if (existing) {
    return c.json({ error: "An account with this email already exists" }, 409);
  }

  // Create user with the privileges set in the magic link
  const user = await createUser({
    email: link.email,
    password,
    displayName: link.displayName,
    isAdmin: link.isAdmin,
    isAuthorized: link.isAuthorized,
  });

  const session = createSession(user.id);
  setSessionCookie(c, session.id);

  return c.json(user, 201);
});

/** Log in */
app.post("/login", async (c) => {
  const { email, password } = await c.req.json<{ email: string; password: string }>();

  if (!email?.trim() || !password) {
    return c.json({ error: "Email and password are required" }, 400);
  }

  const user = findUserByEmail(email);
  if (!user) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  if (!user.passwordHash) {
    return c.json({ error: "No password set. Please use your magic link to set a password." }, 401);
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  const session = createSession(user.id);
  setSessionCookie(c, session.id);

  const { passwordHash: _, ...profile } = user;
  return c.json(profile);
});

/** Log out */
app.post("/logout", (c) => {
  const sessionId = getCookie(c, "session");
  if (sessionId) {
    deleteSession(sessionId);
  }
  deleteCookie(c, "session", { path: "/" });
  return c.json({ ok: true });
});

/** Get current user */
app.get("/me", (c) => {
  if (getUserCount() === 0) {
    return c.json({ needsSetup: true });
  }
  const user = c.get("user");
  if (!user) return c.json({ error: "Not authenticated" }, 401);
  return c.json(user);
});

export { app as authRouter };

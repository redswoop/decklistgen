import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { createUser, findUserByEmail, verifyPassword, getUserCount } from "../services/user-store.js";
import { createSession, deleteSession } from "../services/session-store.js";
import { redeemInviteCode } from "../services/invite-store.js";
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

  const user = await createUser({ email, password, displayName, isAdmin: true });
  const session = createSession(user.id);
  setSessionCookie(c, session.id);

  return c.json(user, 201);
});

/** Sign up with invite code */
app.post("/signup", async (c) => {
  const { email, password, displayName, inviteCode } = await c.req.json<{
    email: string;
    password: string;
    displayName: string;
    inviteCode: string;
  }>();

  if (!email?.trim() || !password || !displayName?.trim() || !inviteCode?.trim()) {
    return c.json({ error: "All fields are required" }, 400);
  }
  if (password.length < 8) {
    return c.json({ error: "Password must be at least 8 characters" }, 400);
  }

  const existing = findUserByEmail(email);
  if (existing) {
    return c.json({ error: "Email already in use" }, 409);
  }

  // Create user first, then redeem code
  const user = await createUser({ email, password, displayName });
  const redeemed = redeemInviteCode(inviteCode, user.id);
  if (!redeemed) {
    // Roll back: delete the user we just created
    const { getDb } = await import("../services/db/database.js");
    getDb().query("DELETE FROM users WHERE id = ?").run(user.id);
    return c.json({ error: "Invalid or already used invite code" }, 400);
  }

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

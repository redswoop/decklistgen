import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { validateSession } from "../services/session-store.js";
import type { User } from "../../shared/types/user.js";
import type { AppEnv } from "../types.js";

export type AuthUser = User;

/** Resolve session on every request. Does NOT block unauthenticated requests. */
export const sessionMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const sessionId = getCookie(c, "session");
  if (sessionId) {
    const user = validateSession(sessionId);
    c.set("user", user);
  } else {
    c.set("user", null);
  }
  await next();
});

/** Block unauthenticated requests with 401. */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Authentication required" }, 401);
  await next();
});

/** Block non-admin requests with 403. */
export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Authentication required" }, 401);
  if (!user.isAdmin) return c.json({ error: "Admin access required" }, 403);
  await next();
});

/** Block unauthorized (free-tier) users. Admins always pass. */
export const requireAuthorized = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Authentication required" }, 401);
  if (!user.isAuthorized && !user.isAdmin) return c.json({ error: "Authorized access required" }, 403);
  await next();
});

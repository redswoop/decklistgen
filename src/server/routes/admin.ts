import { Hono } from "hono";
import { requireAdmin } from "../middleware/auth.js";
import { listAllUsers, setUserAuthorized, setUserAdmin, deleteUser } from "../services/user-store.js";
import { createMagicLink, listMagicLinks, deleteMagicLink } from "../services/magic-link-store.js";
import { migrateAll } from "../services/db/migrate.js";
import type { AppEnv } from "../types.js";

const app = new Hono<AppEnv>();

app.use("*", requireAdmin);

/** List all users */
app.get("/users", (c) => {
  return c.json(listAllUsers());
});

/** Toggle user authorized status */
app.patch("/users/:id/authorize", async (c) => {
  const userId = c.req.param("id");
  const { authorized } = await c.req.json<{ authorized: boolean }>();
  const user = setUserAuthorized(userId, authorized);
  if (!user) return c.json({ error: "User not found" }, 404);
  return c.json(user);
});

/** Toggle user admin status */
app.patch("/users/:id/admin", async (c) => {
  const userId = c.req.param("id");
  const currentUser = c.get("user")!;
  if (userId === currentUser.id) {
    return c.json({ error: "Cannot change your own admin status" }, 400);
  }
  const { isAdmin } = await c.req.json<{ isAdmin: boolean }>();
  const user = setUserAdmin(userId, isAdmin);
  if (!user) return c.json({ error: "User not found" }, 404);
  return c.json(user);
});

/** Delete a user */
app.delete("/users/:id", (c) => {
  const userId = c.req.param("id");
  const currentUser = c.get("user")!;
  if (userId === currentUser.id) {
    return c.json({ error: "Cannot delete yourself" }, 400);
  }
  const ok = deleteUser(userId);
  if (!ok) return c.json({ error: "User not found" }, 404);
  return c.json({ ok: true });
});

/** Create a magic link */
app.post("/magic-links", async (c) => {
  const user = c.get("user")!;
  const { email, displayName, isAuthorized, isAdmin } = await c.req.json<{
    email: string;
    displayName: string;
    isAuthorized?: boolean;
    isAdmin?: boolean;
  }>();

  if (!email?.trim() || !displayName?.trim()) {
    return c.json({ error: "Email and display name are required" }, 400);
  }

  const link = createMagicLink({
    email,
    displayName,
    isAuthorized: isAuthorized ?? false,
    isAdmin: isAdmin ?? false,
    createdBy: user.id,
  });

  return c.json(link, 201);
});

/** List all magic links */
app.get("/magic-links", (c) => {
  return c.json(listMagicLinks());
});

/** Revoke an unused magic link */
app.delete("/magic-links/:token", (c) => {
  const token = c.req.param("token");
  const ok = deleteMagicLink(token);
  if (!ok) return c.json({ error: "Link not found or already used" }, 404);
  return c.json({ ok: true });
});

/** Run data migration from JSON files to SQLite */
app.post("/migrate", async (c) => {
  const user = c.get("user")!;
  const result = await migrateAll(user.id);
  return c.json(result);
});

export { app as adminRouter };

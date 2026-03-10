import { Hono } from "hono";
import { requireAdmin } from "../middleware/auth.js";
import { createInviteCode, listInviteCodes, deleteInviteCode } from "../services/invite-store.js";
import { migrateAll } from "../services/db/migrate.js";
import type { AppEnv } from "../types.js";

const app = new Hono<AppEnv>();

app.use("*", requireAdmin);

/** Generate a new invite code */
app.post("/invite-codes", (c) => {
  const user = c.get("user")!;
  const invite = createInviteCode(user.id);
  return c.json(invite, 201);
});

/** List all invite codes */
app.get("/invite-codes", (c) => {
  return c.json(listInviteCodes());
});

/** Revoke an unused invite code */
app.delete("/invite-codes/:code", (c) => {
  const code = c.req.param("code");
  const ok = deleteInviteCode(code);
  if (!ok) return c.json({ error: "Code not found or already used" }, 404);
  return c.json({ ok: true });
});

/** Run data migration from JSON files to SQLite */
app.post("/migrate", async (c) => {
  const user = c.get("user")!;
  const result = await migrateAll(user.id);
  return c.json(result);
});

export { app as adminRouter };

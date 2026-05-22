import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Hono } from "hono";
import type { AppEnv } from "../types.js";
import { templateSetsRouter } from "./template-sets.js";
import { clearTemplateSetCache } from "../services/template-set-store.js";

let tmpRoot: string;
let builtinPath: string;
let userPath: string;
let shadowsPath: string;
let savedEnv: Record<string, string | undefined>;
let app: Hono<AppEnv>;

function writeJson(path: string, obj: unknown): void {
  writeFileSync(path, JSON.stringify(obj));
}

function buildApp(opts: { user?: { isAuthorized: boolean; isAdmin: boolean; email?: string } } = {}): Hono<AppEnv> {
  const a = new Hono<AppEnv>();
  a.use("*", async (c, next) => {
    if (opts.user) c.set("user", opts.user as never);
    await next();
  });
  a.route("/", templateSetsRouter);
  return a;
}

beforeEach(() => {
  tmpRoot = join(tmpdir(), `tmpl-routes-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  builtinPath = join(tmpRoot, "builtin");
  userPath = join(tmpRoot, "users");
  shadowsPath = join(tmpRoot, "shadows");
  mkdirSync(builtinPath, { recursive: true });
  mkdirSync(userPath, { recursive: true });
  mkdirSync(shadowsPath, { recursive: true });

  // Seed a default builtin set
  mkdirSync(join(builtinPath, "default"), { recursive: true });
  writeJson(join(builtinPath, "default", "set.json"), { id: "default", name: "Default" });
  writeJson(join(builtinPath, "default", "pokemon-standard.json"), {
    id: "pokemon-standard", name: "PS", elements: [{ type: "text", props: { text: "orig" } }],
  });

  savedEnv = {
    BUILTIN_TEMPLATES_PATH: process.env.BUILTIN_TEMPLATES_PATH,
    TEMPLATE_SETS_PATH: process.env.TEMPLATE_SETS_PATH,
    BUILTIN_SHADOWS_PATH: process.env.BUILTIN_SHADOWS_PATH,
    BUILTIN_EDIT_MODE: process.env.BUILTIN_EDIT_MODE,
  };
  process.env.BUILTIN_TEMPLATES_PATH = builtinPath;
  process.env.TEMPLATE_SETS_PATH = userPath;
  process.env.BUILTIN_SHADOWS_PATH = shadowsPath;
  process.env.BUILTIN_EDIT_MODE = "direct";
  clearTemplateSetCache();

  app = buildApp({ user: { isAuthorized: true, isAdmin: false, email: "test@example.com" } });
});

afterEach(() => {
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  clearTemplateSetCache();
  rmSync(tmpRoot, { recursive: true, force: true });
});

describe("GET /", () => {
  it("returns builtin set summaries", async () => {
    const res = await app.request("/");
    expect(res.status).toBe(200);
    const list = await res.json() as Array<{ id: string; origin: string }>;
    expect(list.map((s) => s.id)).toEqual(["default"]);
    expect(list[0].origin).toBe("builtin");
  });
});

describe("GET /policy", () => {
  it("reports the current edit mode and global set", async () => {
    const res = await app.request("/policy");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.builtinEditMode).toBe("direct");
    expect(body.globalSetId).toBe("default");
  });
});

describe("GET /:setId", () => {
  it("returns a set summary with slot ids", async () => {
    const res = await app.request("/default");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("default");
    expect(body.slotIds).toContain("pokemon-standard");
  });

  it("returns 404 for unknown set", async () => {
    const res = await app.request("/ghost");
    expect(res.status).toBe(404);
  });
});

describe("GET /:setId/templates/:slotId", () => {
  it("returns the slot template", async () => {
    const res = await app.request("/default/templates/pokemon-standard");
    expect(res.status).toBe(200);
    const tmpl = await res.json();
    expect(tmpl.id).toBe("pokemon-standard");
    expect(tmpl.name).toBe("PS");
  });

  it("walks extends chain", async () => {
    mkdirSync(join(userPath, "child"), { recursive: true });
    writeJson(join(userPath, "child", "set.json"), { id: "child", name: "Child", extends: "default" });
    clearTemplateSetCache();
    const res = await app.request("/child/templates/pokemon-standard");
    expect(res.status).toBe(200);
    const tmpl = await res.json();
    expect(tmpl.name).toBe("PS");
  });

  it("404 when missing in chain", async () => {
    const res = await app.request("/default/templates/trainer");
    expect(res.status).toBe(404);
  });
});

describe("POST /:setId/templates/:slotId — direct mode", () => {
  it("writes a builtin slot template to source path", async () => {
    const res = await app.request("/default/templates/pokemon-standard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated PS", elements: [{ type: "text", props: { text: "v2" } }] }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mode).toBe("direct");
    const onDisk = JSON.parse(readFileSync(join(builtinPath, "default", "pokemon-standard.json"), "utf-8"));
    expect(onDisk.name).toBe("Updated PS");
  });

  it("401 when unauthenticated", async () => {
    const unauth = buildApp();
    const res = await unauth.request("/default/templates/pokemon-standard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "x", elements: [] }),
    });
    expect(res.status).toBe(401);
  });
});

describe("POST /:setId/templates/:slotId — locked mode", () => {
  it("403s when BUILTIN_EDIT_MODE=locked", async () => {
    process.env.BUILTIN_EDIT_MODE = "locked";
    clearTemplateSetCache();
    const res = await app.request("/default/templates/pokemon-standard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "blocked", elements: [] }),
    });
    expect(res.status).toBe(403);
  });
});

describe("POST /:setId/templates/:slotId — shadow mode", () => {
  beforeEach(() => {
    process.env.BUILTIN_EDIT_MODE = "shadow";
    clearTemplateSetCache();
  });

  it("412 without the confirmation header", async () => {
    const res = await app.request("/default/templates/pokemon-standard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "shadowed", elements: [] }),
    });
    expect(res.status).toBe(412);
  });

  it("writes to shadow path with confirmation header", async () => {
    const res = await app.request("/default/templates/pokemon-standard", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Confirm-Shadow-Edit": "i-understand",
      },
      body: JSON.stringify({ name: "shadowed", elements: [] }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mode).toBe("shadow");
    expect(existsSync(join(shadowsPath, "default", "pokemon-standard.json"))).toBe(true);
    const manifest = JSON.parse(readFileSync(join(shadowsPath, "default", "shadow.json"), "utf-8"));
    expect(manifest.setId).toBe("default");
    expect(manifest.syncStatus).toBe("pending");
    // Original is unchanged
    const orig = JSON.parse(readFileSync(join(builtinPath, "default", "pokemon-standard.json"), "utf-8"));
    expect(orig.elements?.[0]?.props?.text).toBe("orig");
  });
});

describe("DELETE /:setId/templates/:slotId", () => {
  it("deletes a builtin slot file in direct mode", async () => {
    const res = await app.request("/default/templates/pokemon-standard", { method: "DELETE" });
    expect(res.status).toBe(200);
    expect(existsSync(join(builtinPath, "default", "pokemon-standard.json"))).toBe(false);
  });

  it("404 when the file does not exist", async () => {
    const res = await app.request("/default/templates/trainer", { method: "DELETE" });
    expect(res.status).toBe(404);
  });

  it("removes shadow overlay and cleans empty dir", async () => {
    process.env.BUILTIN_EDIT_MODE = "shadow";
    clearTemplateSetCache();
    // Plant a shadow first
    mkdirSync(join(shadowsPath, "default"), { recursive: true });
    writeJson(join(shadowsPath, "default", "shadow.json"), { setId: "default" });
    writeJson(join(shadowsPath, "default", "pokemon-standard.json"), { id: "x", name: "x", elements: [] });
    clearTemplateSetCache();

    const res = await app.request("/default/templates/pokemon-standard", {
      method: "DELETE",
      headers: { "X-Confirm-Shadow-Edit": "i-understand" },
    });
    expect(res.status).toBe(200);
    expect(existsSync(join(shadowsPath, "default"))).toBe(false);
  });
});

describe("POST /:setId/cards/:cardId — user set", () => {
  beforeEach(() => {
    mkdirSync(join(userPath, "my-set"), { recursive: true });
    writeJson(join(userPath, "my-set", "set.json"), { id: "my-set", name: "Mine", extends: "default" });
    clearTemplateSetCache();
  });

  it("writes a card-specific template into the user set", async () => {
    const res = await app.request("/my-set/cards/sv4-1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Pikachu custom", elements: [] }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mode).toBe("user");
    expect(existsSync(join(userPath, "my-set", "cards", "sv4-1.json"))).toBe(true);
  });
});

describe("POST /:setId/fork", () => {
  it("creates a user set that extends the source builtin", async () => {
    const res = await app.request("/default/fork", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "my-fork", name: "My Fork" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("my-fork");
    expect(body.extends).toBe("default");

    const manifest = JSON.parse(readFileSync(join(userPath, "my-fork", "set.json"), "utf-8"));
    expect(manifest.extends).toBe("default");
    expect(manifest.name).toBe("My Fork");
  });

  it("can fork a user set", async () => {
    mkdirSync(join(userPath, "parent"), { recursive: true });
    writeJson(join(userPath, "parent", "set.json"), { id: "parent", name: "Parent", extends: "default" });
    clearTemplateSetCache();
    const res = await app.request("/parent/fork", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "grandchild", name: "Grandchild" }),
    });
    expect(res.status).toBe(200);
    const manifest = JSON.parse(readFileSync(join(userPath, "grandchild", "set.json"), "utf-8"));
    expect(manifest.extends).toBe("parent");
  });

  it("409 on duplicate id", async () => {
    const a = await app.request("/default/fork", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "dup", name: "First" }),
    });
    expect(a.status).toBe(200);
    const b = await app.request("/default/fork", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "dup", name: "Second" }),
    });
    expect(b.status).toBe(409);
  });

  it("400 on invalid target id", async () => {
    const res = await app.request("/default/fork", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "bad id!", name: "x" }),
    });
    expect(res.status).toBe(400);
  });

  it("400 on missing fields", async () => {
    const res = await app.request("/default/fork", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "only-id" }),
    });
    expect(res.status).toBe(400);
  });

  it("404 on unknown source set", async () => {
    const res = await app.request("/ghost/fork", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "x", name: "x" }),
    });
    expect(res.status).toBe(404);
  });

  it("401 when unauthenticated", async () => {
    const unauth = buildApp();
    const res = await unauth.request("/default/fork", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "x", name: "x" }),
    });
    expect(res.status).toBe(401);
  });
});

describe("POST /:setId — update user-set metadata", () => {
  beforeEach(() => {
    mkdirSync(join(userPath, "my-set"), { recursive: true });
    writeJson(join(userPath, "my-set", "set.json"), { id: "my-set", name: "Mine", extends: "default" });
    clearTemplateSetCache();
  });

  it("updates name and description", async () => {
    const res = await app.request("/my-set", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Renamed", description: "Updated" }),
    });
    expect(res.status).toBe(200);
    const manifest = JSON.parse(readFileSync(join(userPath, "my-set", "set.json"), "utf-8"));
    expect(manifest.name).toBe("Renamed");
    expect(manifest.description).toBe("Updated");
    expect(manifest.extends).toBe("default");
  });

  it("403 on builtin sets", async () => {
    const res = await app.request("/default", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Hacked" }),
    });
    expect(res.status).toBe(403);
  });

  it("404 on missing set", async () => {
    const res = await app.request("/ghost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "x" }),
    });
    expect(res.status).toBe(404);
  });

  it("401 when unauthenticated", async () => {
    const unauth = buildApp();
    const res = await unauth.request("/my-set", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "x" }),
    });
    expect(res.status).toBe(401);
  });
});

describe("DELETE /:setId — delete user set", () => {
  beforeEach(() => {
    mkdirSync(join(userPath, "to-delete", "cards"), { recursive: true });
    writeJson(join(userPath, "to-delete", "set.json"), { id: "to-delete", name: "Dead Set Walking" });
    writeJson(join(userPath, "to-delete", "trainer.json"), { id: "t", name: "t", elements: [] });
    writeJson(join(userPath, "to-delete", "cards", "sv4-1.json"), { id: "sv4-1", name: "x", elements: [] });
    clearTemplateSetCache();
  });

  it("recursively removes the user set directory", async () => {
    const res = await app.request("/to-delete", { method: "DELETE" });
    expect(res.status).toBe(200);
    expect(existsSync(join(userPath, "to-delete"))).toBe(false);
  });

  it("403 on builtin sets", async () => {
    const res = await app.request("/default", { method: "DELETE" });
    expect(res.status).toBe(403);
  });

  it("404 on missing set", async () => {
    const res = await app.request("/ghost", { method: "DELETE" });
    expect(res.status).toBe(404);
  });
});

describe("export / import", () => {
  beforeEach(() => {
    mkdirSync(join(builtinPath, "default", "cards"), { recursive: true });
    writeJson(join(builtinPath, "default", "cards", "sv4-1.json"), {
      id: "sv4-1", name: "Pikachu Custom", elements: [{ type: "text", props: { text: "p" } }],
    });
    clearTemplateSetCache();
  });

  it("GET /:setId/export returns a bundle with manifest + slots + cards", async () => {
    const res = await app.request("/default/export");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain("default.template-set.json");
    const body = await res.json();
    expect(body.manifest.id).toBe("default");
    expect(body.slots["pokemon-standard"]).toBeDefined();
    expect(body.cards["sv4-1"]?.name).toBe("Pikachu Custom");
  });

  it("POST /import roundtrips a user set", async () => {
    const exp = await app.request("/default/export");
    const bundle = await exp.json();
    bundle.id = "imported";
    const res = await app.request("/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bundle),
    });
    expect(res.status).toBe(200);
    const newSet = JSON.parse(readFileSync(join(userPath, "imported", "set.json"), "utf-8"));
    expect(newSet.name).toBe("Default");
    expect(existsSync(join(userPath, "imported", "pokemon-standard.json"))).toBe(true);
    expect(existsSync(join(userPath, "imported", "cards", "sv4-1.json"))).toBe(true);
  });

  it("POST /import 409 on duplicate id", async () => {
    const res = await app.request("/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ manifest: { id: "default", name: "Dup" } }),
    });
    expect(res.status).toBe(409);
  });

  it("POST /import 400 on missing manifest", async () => {
    const res = await app.request("/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slots: {} }),
    });
    expect(res.status).toBe(400);
  });

  it("POST /import 401 when unauthenticated", async () => {
    const unauth = buildApp();
    const res = await unauth.request("/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ manifest: { id: "x", name: "x" } }),
    });
    expect(res.status).toBe(401);
  });
});

describe("shadow management", () => {
  let adminApp: Hono<AppEnv>;
  beforeEach(() => {
    adminApp = buildApp({ user: { isAuthorized: true, isAdmin: true, email: "admin@example.com" } });
    mkdirSync(join(shadowsPath, "default", "cards"), { recursive: true });
    writeJson(join(shadowsPath, "default", "shadow.json"), {
      setId: "default",
      createdAt: "2026-01-01T00:00:00Z",
      lastEditedAt: "2026-01-02T00:00:00Z",
      editor: "admin@example.com",
      syncStatus: "pending",
    });
    writeJson(join(shadowsPath, "default", "pokemon-fullart.json"), { id: "pf", name: "Shadow PF", elements: [] });
    writeJson(join(shadowsPath, "default", "cards", "sv4-1.json"), { id: "sv4-1", name: "Shadow Pikachu", elements: [] });
    clearTemplateSetCache();
  });

  it("GET /builtin-shadows lists shadows with metadata", async () => {
    const res = await adminApp.request("/builtin-shadows");
    expect(res.status).toBe(200);
    const list = await res.json();
    expect(list).toHaveLength(1);
    expect(list[0].setId).toBe("default");
    expect(list[0].slotIds).toEqual(["pokemon-fullart"]);
    expect(list[0].cardIds).toEqual(["sv4-1"]);
    expect(list[0].editor).toBe("admin@example.com");
  });

  it("GET /builtin-shadows requires admin", async () => {
    const nonAdmin = buildApp({ user: { isAuthorized: true, isAdmin: false } });
    const res = await nonAdmin.request("/builtin-shadows");
    expect(res.status).toBe(403);
  });

  it("GET /builtin-shadows/export bundles all shadows", async () => {
    const res = await adminApp.request("/builtin-shadows/export");
    expect(res.status).toBe(200);
    const bundle = await res.json();
    expect(bundle.shadows).toHaveLength(1);
    expect(bundle.shadows[0].setId).toBe("default");
    expect(bundle.shadows[0].slots["pokemon-fullart"]?.name).toBe("Shadow PF");
    expect(bundle.shadows[0].cards["sv4-1"]?.name).toBe("Shadow Pikachu");
  });

  it("DELETE /builtin-shadows/:setId removes the overlay dir", async () => {
    const res = await adminApp.request("/builtin-shadows/default", { method: "DELETE" });
    expect(res.status).toBe(200);
    expect(existsSync(join(shadowsPath, "default"))).toBe(false);
  });

  it("DELETE /builtin-shadows/:setId 404 when no shadow exists", async () => {
    rmSync(join(shadowsPath, "default"), { recursive: true });
    const res = await adminApp.request("/builtin-shadows/default", { method: "DELETE" });
    expect(res.status).toBe(404);
  });
});

describe("validation", () => {
  it("rejects invalid set id", async () => {
    const res = await app.request("/bad..id/templates/pokemon-standard");
    expect(res.status).toBe(400);
  });

  it("rejects invalid slot id", async () => {
    const res = await app.request("/default/templates/bad..slot");
    expect(res.status).toBe(400);
  });
});

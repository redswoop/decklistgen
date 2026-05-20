import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  clearTemplateSetCache,
  getAllSets,
  getSet,
  isBuiltin,
  listSetSummaries,
} from "./template-set-store.js";

let tmpRoot: string;
let builtinPath: string;
let userPath: string;
let shadowsPath: string;
let savedEnv: Record<string, string | undefined>;

function writeJson(path: string, obj: unknown): void {
  writeFileSync(path, JSON.stringify(obj));
}

beforeEach(() => {
  tmpRoot = join(tmpdir(), `tmpl-store-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  builtinPath = join(tmpRoot, "builtin");
  userPath = join(tmpRoot, "users");
  shadowsPath = join(tmpRoot, "shadows");
  mkdirSync(builtinPath, { recursive: true });
  mkdirSync(userPath, { recursive: true });
  mkdirSync(shadowsPath, { recursive: true });
  savedEnv = {
    BUILTIN_TEMPLATES_PATH: process.env.BUILTIN_TEMPLATES_PATH,
    TEMPLATE_SETS_PATH: process.env.TEMPLATE_SETS_PATH,
    BUILTIN_SHADOWS_PATH: process.env.BUILTIN_SHADOWS_PATH,
  };
  process.env.BUILTIN_TEMPLATES_PATH = builtinPath;
  process.env.TEMPLATE_SETS_PATH = userPath;
  process.env.BUILTIN_SHADOWS_PATH = shadowsPath;
  clearTemplateSetCache();
});

afterEach(() => {
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  clearTemplateSetCache();
  rmSync(tmpRoot, { recursive: true, force: true });
});

describe("template-set-store", () => {
  it("loads a builtin set with slot and card templates", () => {
    const setDir = join(builtinPath, "default");
    mkdirSync(join(setDir, "cards"), { recursive: true });
    writeJson(join(setDir, "set.json"), { id: "default", name: "Default" });
    writeJson(join(setDir, "pokemon-standard.json"), { id: "ps", name: "PS", elements: [] });
    writeJson(join(setDir, "cards", "sv4-1.json"), { id: "sv4-1", name: "Pikachu Custom", elements: [] });

    const set = getSet("default");
    expect(set).toBeDefined();
    expect(set!.origin).toBe("builtin");
    expect(set!.slotTemplates["pokemon-standard"]?.id).toBe("ps");
    expect(set!.cardTemplates["sv4-1"]?.name).toBe("Pikachu Custom");
  });

  it("loads user sets from the user path", () => {
    const setDir = join(userPath, "my-set");
    mkdirSync(setDir, { recursive: true });
    writeJson(join(setDir, "set.json"), { id: "my-set", name: "My Set", extends: "default" });
    writeJson(join(setDir, "trainer.json"), { id: "t", name: "Trainer", elements: [] });

    const set = getSet("my-set");
    expect(set).toBeDefined();
    expect(set!.origin).toBe("user");
    expect(set!.manifest.extends).toBe("default");
    expect(isBuiltin("my-set")).toBe(false);
  });

  it("layers shadow files over the matching builtin set", () => {
    const builtinDir = join(builtinPath, "default");
    mkdirSync(builtinDir, { recursive: true });
    writeJson(join(builtinDir, "set.json"), { id: "default", name: "Default" });
    writeJson(join(builtinDir, "pokemon-standard.json"), { id: "ps", name: "Original PS", elements: [] });

    const shadowDir = join(shadowsPath, "default");
    mkdirSync(shadowDir, { recursive: true });
    writeJson(join(shadowDir, "shadow.json"), { setId: "default", syncStatus: "pending" });
    writeJson(join(shadowDir, "pokemon-standard.json"), { id: "ps", name: "Shadow PS", elements: [] });

    const set = getSet("default");
    expect(set?.slotTemplates["pokemon-standard"]?.name).toBe("Shadow PS");
    expect(set?.hasShadow).toBe(true);
  });

  it("shadow files for unknown builtin ids are ignored", () => {
    mkdirSync(join(shadowsPath, "ghost"), { recursive: true });
    writeJson(join(shadowsPath, "ghost", "shadow.json"), { setId: "ghost" });
    writeJson(join(shadowsPath, "ghost", "trainer.json"), { id: "t", name: "T", elements: [] });

    expect(getSet("ghost")).toBeUndefined();
  });

  it("listSetSummaries orders builtin first then by name", () => {
    mkdirSync(join(builtinPath, "default"), { recursive: true });
    writeJson(join(builtinPath, "default", "set.json"), { id: "default", name: "Z-Default" });
    mkdirSync(join(userPath, "alpha"), { recursive: true });
    writeJson(join(userPath, "alpha", "set.json"), { id: "alpha", name: "Alpha" });
    mkdirSync(join(userPath, "beta"), { recursive: true });
    writeJson(join(userPath, "beta", "set.json"), { id: "beta", name: "Beta" });

    const list = listSetSummaries();
    expect(list.map((s) => s.id)).toEqual(["default", "alpha", "beta"]);
  });

  it("clearTemplateSetCache picks up file changes", () => {
    const setDir = join(builtinPath, "default");
    mkdirSync(setDir, { recursive: true });
    writeJson(join(setDir, "set.json"), { id: "default", name: "Default" });
    writeJson(join(setDir, "trainer.json"), { id: "t", name: "v1", elements: [] });
    expect(getSet("default")?.slotTemplates["trainer"]?.name).toBe("v1");

    writeJson(join(setDir, "trainer.json"), { id: "t", name: "v2", elements: [] });
    clearTemplateSetCache();
    expect(getSet("default")?.slotTemplates["trainer"]?.name).toBe("v2");
  });

  it("returns an empty set list when paths do not exist", () => {
    process.env.BUILTIN_TEMPLATES_PATH = join(tmpRoot, "nope");
    process.env.TEMPLATE_SETS_PATH = join(tmpRoot, "nope2");
    clearTemplateSetCache();
    expect(getAllSets().size).toBe(0);
  });
});

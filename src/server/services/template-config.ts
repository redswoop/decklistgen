import { join } from "node:path";
import type { BuiltinEditMode } from "../../shared/types/template.js";

/** Server config for the template-sets subsystem. Reads env vars on every call so
 *  tests can flip values between cases via `process.env.X = "..."` without restart. */

const FILE_DIR = import.meta.dir;
const BUILTIN_DEFAULT = join(FILE_DIR, "../templates/builtin");
const USER_SETS_DEFAULT = join(FILE_DIR, "../../../data/template-sets");
const SHADOWS_DEFAULT = join(FILE_DIR, "../../../data/builtin-shadows");

export function getBuiltinTemplatesPath(): string {
  return process.env.BUILTIN_TEMPLATES_PATH ?? BUILTIN_DEFAULT;
}

export function getTemplateSetsPath(): string {
  return process.env.TEMPLATE_SETS_PATH ?? USER_SETS_DEFAULT;
}

export function getBuiltinShadowsPath(): string {
  return process.env.BUILTIN_SHADOWS_PATH ?? SHADOWS_DEFAULT;
}

export function getBuiltinEditMode(): BuiltinEditMode {
  const raw = process.env.BUILTIN_EDIT_MODE;
  if (raw === "direct" || raw === "shadow" || raw === "locked") return raw;
  return "direct";
}

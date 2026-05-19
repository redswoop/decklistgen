/**
 * Test preload — redirects file-backed stores to per-process temp files so the
 * user's real overrides in data/*.json are never touched by tests.
 *
 * Wired via bunfig.toml's [test] preload.
 */

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "decklistgen-test-"));

process.env.FONT_FAMILY_STORE_PATH ??= join(dir, "font-family.json");
process.env.FONT_SIZE_STORE_PATH ??= join(dir, "font-sizes.json");
process.env.TEXT_MODE_OVERRIDE_STORE_PATH ??= join(dir, "text-mode-overrides.json");

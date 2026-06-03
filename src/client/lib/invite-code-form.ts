/**
 * Parse the optional "max uses" field on the create-invite-code form.
 * Blank means unlimited (null). Anything present must be a positive integer.
 */
export type ParseMaxUsesResult =
  | { ok: true; value: number | null }
  | { ok: false; error: string };

export function parseMaxUses(raw: string): ParseMaxUsesResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };
  const n = parseInt(trimmed, 10);
  if (isNaN(n) || n < 1) {
    return { ok: false, error: "Max uses must be a positive number or empty for unlimited" };
  }
  return { ok: true, value: n };
}

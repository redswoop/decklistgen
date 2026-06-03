import type { MagicLink } from "../../shared/types/user.js";

export type MagicLinkStatus = "used" | "expired" | "pending";

/**
 * Lifecycle state of a magic link: consumed, past its expiry, or still
 * actionable. `now` is injectable so the logic is deterministic under test.
 */
export function linkStatus(link: MagicLink, now: Date = new Date()): MagicLinkStatus {
  if (link.usedAt) return "used";
  if (new Date(link.expiresAt) < now) return "expired";
  return "pending";
}

/**
 * Format an ISO date string as a short, human "Mon D, YYYY" label.
 * Shared by the admin tables (users / invite codes / magic links).
 */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

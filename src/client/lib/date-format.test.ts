import { describe, it, expect } from "bun:test";
import { formatDate } from "./date-format.js";

describe("formatDate", () => {
  it("formats an ISO timestamp as short month/day/year", () => {
    // Use a midday UTC time so the local date matches regardless of timezone.
    expect(formatDate("2026-05-30T12:00:00.000Z")).toBe("May 30, 2026");
  });

  it("handles a date-only ISO string", () => {
    // Date-only parses as UTC midnight; assert via the same Date path rather
    // than a hardcoded string to stay timezone-agnostic.
    const expected = new Date("2024-01-01").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    expect(formatDate("2024-01-01")).toBe(expected);
  });
});

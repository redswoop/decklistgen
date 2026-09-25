import type { PrintPaper, PrintOrientation } from "../../shared/utils/print-grid.js";

/**
 * Layout knobs for a deck print, remembered across prints in localStorage.
 * Shared by PrintDialog (which edits them) and the deck grid's print bar (which
 * reads paper/orientation to size its live sheet estimate). Which cards print,
 * and how many, is the print plan's business — see usePrintPlan.
 */
export interface PrintOptions {
  artwork: "proxy" | "original";
  paper: PrintPaper;
  orientation: PrintOrientation;
  cropMarks: boolean;
}

export const PRINT_OPTIONS_KEY = "print-options-v1";

const DEFAULTS: PrintOptions = {
  artwork: "proxy",
  paper: "letter",
  orientation: "portrait",
  cropMarks: true,
};

export function loadPrintOptions(): PrintOptions {
  try {
    const raw = localStorage.getItem(PRINT_OPTIONS_KEY);
    const stored = raw ? (JSON.parse(raw) as Partial<PrintOptions>) : {};
    return {
      artwork: stored.artwork === "original" ? "original" : DEFAULTS.artwork,
      paper: stored.paper === "super-b" ? "super-b" : DEFAULTS.paper,
      orientation: stored.orientation === "landscape" ? "landscape" : DEFAULTS.orientation,
      cropMarks: typeof stored.cropMarks === "boolean" ? stored.cropMarks : DEFAULTS.cropMarks,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function savePrintOptions(opts: PrintOptions) {
  try {
    localStorage.setItem(PRINT_OPTIONS_KEY, JSON.stringify(opts));
  } catch {
    /* private mode etc. */
  }
}

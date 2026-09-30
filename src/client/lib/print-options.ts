import type { PrintPaper, PrintOrientation } from "../../shared/utils/print-grid.js";
import type { PrintMode } from "../../shared/utils/print-params.js";

/**
 * Layout knobs for a deck print, remembered across prints in localStorage.
 * Artwork is not one of them: it follows the app's Original/Proxy toggle.
 * Shared by PrintDialog (which edits them) and the deck grid's print bar (which
 * reads paper/orientation to size its live sheet estimate). Which cards print,
 * and how many, is the print plan's business — see usePrintPlan.
 */
export interface PrintOptions {
  paper: PrintPaper;
  orientation: PrintOrientation;
  cropMarks: boolean;
  mode: PrintMode;
}

export const PRINT_OPTIONS_KEY = "print-options-v1";

const DEFAULTS: PrintOptions = {
  paper: "letter",
  orientation: "portrait",
  cropMarks: true,
  mode: "sheet",
};

export function loadPrintOptions(): PrintOptions {
  try {
    const raw = localStorage.getItem(PRINT_OPTIONS_KEY);
    const stored = raw ? (JSON.parse(raw) as Partial<PrintOptions>) : {};
    return {
      paper: stored.paper === "super-b" ? "super-b" : DEFAULTS.paper,
      orientation: stored.orientation === "landscape" ? "landscape" : DEFAULTS.orientation,
      cropMarks: typeof stored.cropMarks === "boolean" ? stored.cropMarks : DEFAULTS.cropMarks,
      mode: stored.mode === "cricut" ? "cricut" : DEFAULTS.mode,
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

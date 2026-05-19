/** Display calibration for true-physical-size previews.
 *
 *  Browsers report CSS pixels, not physical inches. A 275 CSS-px-wide card is
 *  exactly 2.5" only when `cssPxPerInch` matches the user's real display DPI.
 *  This composable persists a calibration value (one per browser profile) so
 *  the Gallery's print-preview mode can render cards at honest print size.
 *
 *  Calibration drift detection: `window.devicePixelRatio` reflects the product
 *  of hardware DPR × OS scaling × browser zoom. We can't read absolute zoom,
 *  but we can detect *changes* by snapshotting DPR when calibration is saved
 *  and comparing on every read. >5% drift triggers a UI warning.
 */
import { ref, computed } from "vue";

const STORAGE_KEY = "decklistgen-display-calibration";

/** CSS pixels per inch on a standard, uncalibrated browser (W3C reference). */
const DEFAULT_DPI = 96;

/** Pokémon card physical dimensions (inches). */
export const CARD_WIDTH_IN = 2.5;
export const CARD_HEIGHT_IN = 3.5;

interface PersistedCalibration {
  cssPxPerInch: number;
  savedDevicePixelRatio: number;
  savedAt: string;
}

function readStorage(): PersistedCalibration | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedCalibration>;
    if (typeof parsed.cssPxPerInch !== "number" || parsed.cssPxPerInch <= 0) return null;
    return {
      cssPxPerInch: parsed.cssPxPerInch,
      savedDevicePixelRatio: typeof parsed.savedDevicePixelRatio === "number"
        ? parsed.savedDevicePixelRatio : 1,
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : "",
    };
  } catch {
    return null;
  }
}

const initial = readStorage();

const cssPxPerInch = ref<number>(initial?.cssPxPerInch ?? DEFAULT_DPI);
const isCalibrated = ref<boolean>(initial !== null);
const savedDevicePixelRatio = ref<number>(initial?.savedDevicePixelRatio ?? 1);
const savedAt = ref<string>(initial?.savedAt ?? "");

/** Reactive snapshot of `window.devicePixelRatio`. Updated by a matchMedia
 *  listener so zoom changes flip the drift warning live. */
const currentDevicePixelRatio = ref<number>(
  typeof window !== "undefined" ? window.devicePixelRatio : 1,
);

if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
  // The matchMedia query needs to be re-armed each fire because the resolution
  // changes when DPR changes.
  let mql: MediaQueryList | null = null;
  const update = () => {
    currentDevicePixelRatio.value = window.devicePixelRatio;
    if (mql) mql.removeEventListener("change", update);
    mql = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    mql.addEventListener("change", update);
  };
  update();
}

const physicalCardPx = computed(() => ({
  w: CARD_WIDTH_IN * cssPxPerInch.value,
  h: CARD_HEIGHT_IN * cssPxPerInch.value,
}));

const zoomDrift = computed(() => {
  if (!isCalibrated.value) return 0;
  const saved = savedDevicePixelRatio.value;
  if (saved <= 0) return 0;
  return Math.abs(currentDevicePixelRatio.value - saved) / saved;
});

function setCalibration(dpi: number): void {
  const clamped = Math.max(40, Math.min(600, dpi));
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio : 1;
  const now = new Date().toISOString();
  cssPxPerInch.value = clamped;
  savedDevicePixelRatio.value = dpr;
  savedAt.value = now;
  isCalibrated.value = true;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      cssPxPerInch: clamped,
      savedDevicePixelRatio: dpr,
      savedAt: now,
    } satisfies PersistedCalibration));
  } catch { /* quota / disabled storage — calibration still works in-session */ }
}

function reset(): void {
  cssPxPerInch.value = DEFAULT_DPI;
  savedDevicePixelRatio.value = 1;
  savedAt.value = "";
  isCalibrated.value = false;
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
}

/** Test hook: force the reactive DPR snapshot to a specific value, simulating
 *  a browser zoom change without an actual zoom. Not exported from a barrel —
 *  consumers shouldn't need this. */
export function __setCurrentDevicePixelRatioForTest(value: number): void {
  currentDevicePixelRatio.value = value;
}

export function useDisplayCalibration() {
  return {
    cssPxPerInch,
    physicalCardPx,
    isCalibrated,
    zoomDrift,
    savedAt,
    setCalibration,
    reset,
  };
}

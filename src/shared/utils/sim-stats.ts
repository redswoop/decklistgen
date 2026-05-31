/**
 * Sampling-error statistics for the Monte-Carlo setup simulator: confidence
 * intervals on the proportions it estimates. Pure, no deps.
 *
 * Proportions use the **Wilson score interval** rather than the normal
 * approximation, because setup rates are routinely near 0 (turn 1 of a Stage 2)
 * or near 1, where the normal interval misbehaves (e.g. "0% ± 0%").
 */

const DEFAULT_Z = 1.96; // 95%

/** Wilson score interval for a binomial proportion `successes / n`. */
export function wilsonInterval(successes: number, n: number, z: number = DEFAULT_Z): { lo: number; hi: number } {
  if (n <= 0) return { lo: 0, hi: 0 };
  const p = successes / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = p + z2 / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return {
    lo: Math.max(0, (center - margin) / denom),
    hi: Math.min(1, (center + margin) / denom),
  };
}

/** Half-width of the Wilson interval — what we render as `±`. */
export function ciHalfWidth(successes: number, n: number, z: number = DEFAULT_Z): number {
  const { lo, hi } = wilsonInterval(successes, n, z);
  return (hi - lo) / 2;
}

/**
 * Half-width of the CI for a sample **mean** (e.g. average setup turn), given the
 * running sum-of-squares. `z·sqrt(sampleVar / n)`; 0 when fewer than 2 samples.
 */
export function meanCIHalfWidth(mean: number, sumSq: number, n: number, z: number = DEFAULT_Z): number {
  if (n < 2) return 0;
  const variance = Math.max(0, sumSq / n - mean * mean);
  return z * Math.sqrt(variance / n);
}

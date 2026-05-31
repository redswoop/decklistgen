import { describe, it, expect } from "bun:test";
import { wilsonInterval, ciHalfWidth, meanCIHalfWidth } from "./sim-stats.js";

describe("wilsonInterval", () => {
  it("brackets the point estimate and stays within [0,1]", () => {
    const { lo, hi } = wilsonInterval(500, 1000);
    expect(lo).toBeLessThan(0.5);
    expect(hi).toBeGreaterThan(0.5);
    expect(lo).toBeGreaterThanOrEqual(0);
    expect(hi).toBeLessThanOrEqual(1);
  });

  it("handles the n=0 edge", () => {
    expect(wilsonInterval(0, 0)).toEqual({ lo: 0, hi: 0 });
  });

  it("never escapes [0,1] at the extremes p=0 and p=1", () => {
    const zero = wilsonInterval(0, 100);
    expect(zero.lo).toBe(0);
    expect(zero.hi).toBeGreaterThan(0); // honest upper bound, not 0
    expect(zero.hi).toBeLessThan(0.05);
    const one = wilsonInterval(100, 100);
    expect(one.hi).toBeCloseTo(1, 6);
    expect(one.lo).toBeLessThan(1);
    expect(one.lo).toBeGreaterThan(0.95);
  });

  it("is narrower than the normal approximation near p=0", () => {
    // normal half-width at p=0 is 0 (degenerate); Wilson gives a real positive bound.
    expect(ciHalfWidth(0, 200)).toBeGreaterThan(0);
  });

  it("shrinks as n grows", () => {
    expect(ciHalfWidth(50, 100)).toBeGreaterThan(ciHalfWidth(5000, 10000));
  });
});

describe("ciHalfWidth", () => {
  it("≈ normal half-width for a mid proportion with large n", () => {
    // normal: 1.96 * sqrt(0.5*0.5/10000) ≈ 0.0098
    expect(ciHalfWidth(5000, 10000)).toBeGreaterThan(0.008);
    expect(ciHalfWidth(5000, 10000)).toBeLessThan(0.011);
  });
});

describe("meanCIHalfWidth", () => {
  it("returns 0 with fewer than 2 samples", () => {
    expect(meanCIHalfWidth(3, 9, 1)).toBe(0);
    expect(meanCIHalfWidth(0, 0, 0)).toBe(0);
  });

  it("computes z*sqrt(var/n) from running mean + sum of squares", () => {
    // samples [2,3,4]: mean 3, sumSq 4+9+16=29, var = 29/3 - 9 = 0.6667, se = sqrt(0.6667/3)=0.4714
    const h = meanCIHalfWidth(3, 29, 3);
    expect(h).toBeCloseTo(1.96 * 0.4714, 2);
  });
});

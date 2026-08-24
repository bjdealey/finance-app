import { mean, stdev, clamp0 } from './stats';

// Real seasonality from a chronological run of monthly totals (one value per month). A season is a
// CONTIGUOUS stretch of elevated months, so this rewards structure (adjacent highs move together) and
// suppresses scattered noise, alternating patterns, and lone spikes — unlike a plain coefficient of
// variation, which can't tell a genuinely seasonal category from a merely erratic one.
//
// The window is treated CIRCULARLY: over a full 12-month window each calendar month appears once and
// month 11 sits next to month 0, so circular lag-1 adjacency == calendar adjacency (Dec↔Jan, Jul↔Aug).
//
// ponytail: with one year of data this reads seasonal SHAPE but can't prove the season RECURS — callers
// should cap confidence (≤ MEDIUM) until ~2+ years exist. A single-month peak reads as a spike, not a
// season (correct separation from annual one-offs, which the recurring engine owns); a two-peak year
// reads lower than one clean season. Fine for a heuristic; widen the window for true multi-year proof.

export interface Seasonality {
  strength: number; // 0..1 — 0 = flat / noisy / one-off, higher = a clear contiguous season
  peakIndex: number; // index of the peak month in the input, or -1 when not meaningfully seasonal
}

// Circular lag-1 autocorrelation in [-1, 1]: high when neighbouring months move together (a contiguous
// season), ~0 for scattered noise, negative for a lone spike or an alternating pattern.
function circularLag1(xs: number[], m: number): number {
  const n = xs.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const d = xs[i] - m;
    num += d * (xs[(i + 1) % n] - m);
    den += d * d;
  }
  return den === 0 ? 0 : num / den;
}

export function seasonality(monthlyTotals: number[]): Seasonality {
  const m = mean(monthlyTotals);
  if (monthlyTotals.length < 4 || m <= 0) return { strength: 0, peakIndex: -1 };
  const concentration = Math.min(1, stdev(monthlyTotals) / m); // dispersion (0..1)
  const contiguity = clamp0(circularLag1(monthlyTotals, m)); // 0..1 — kills noise & lone spikes
  const strength = Math.round(concentration * contiguity * 100) / 100;
  return { strength, peakIndex: strength > 0 ? monthlyTotals.indexOf(Math.max(...monthlyTotals)) : -1 };
}

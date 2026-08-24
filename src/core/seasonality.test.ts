import { describe, it, expect } from 'vitest';
import { seasonality } from './seasonality';

const scale = (xs: number[]) => xs.map((x) => x * 10_000);

describe('seasonality', () => {
  it('scores a contiguous elevated season high', () => {
    const s = seasonality(scale([1, 1, 1, 1, 1, 8, 8, 8, 1, 1, 1, 1])); // summer-style block
    expect(s.strength).toBeGreaterThan(0.3);
    expect(s.peakIndex).toBe(5); // first month of the elevated block
  });

  it('gives ~0 to a lone one-off spike (not a season)', () => {
    expect(seasonality(scale([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12])).strength).toBe(0);
  });

  it('gives ~0 to alternating month-to-month noise', () => {
    expect(seasonality(scale([0, 10, 0, 10, 0, 10, 0, 10, 0, 10, 0, 10])).strength).toBe(0);
  });

  it('gives 0 to perfectly flat spend', () => {
    const s = seasonality(scale([5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5]));
    expect(s.strength).toBe(0);
    expect(s.peakIndex).toBe(-1);
  });

  it('wraps around the year (Dec adjacent to Jan)', () => {
    // Elevated Nov–Feb: a contiguous winter season only if the window is treated circularly.
    const s = seasonality(scale([8, 8, 1, 1, 1, 1, 1, 1, 1, 1, 8, 8]));
    expect(s.strength).toBeGreaterThan(0.3);
  });

  it('returns 0 for too little data', () => {
    expect(seasonality([1, 2, 3]).strength).toBe(0);
  });
});

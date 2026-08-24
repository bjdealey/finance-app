import { describe, it, expect } from 'vitest';
import { computeCategoryStat, analyseSavings } from './behaviour';
import { acc, txn, snap } from './testkit';

const WINDOW = ['2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07'];

describe('computeCategoryStat', () => {
  it('matches the spec restaurant example', () => {
    const totals = [230, 210, 267, 188, 241, 219].map((x) => x * 100);
    const s = computeCategoryStat('rest', totals);
    expect(s.monthlyAverage).toBe(22583);
    expect(s.median).toBe(22450);
    expect(s.min).toBe(18800);
    expect(s.max).toBe(26700);
    expect(s.activeMonths).toBe(6);
    expect(s.confidence).toBe('MEDIUM');
    expect(s.stddev).toBeGreaterThan(0);
    expect(s.likelyRange[0]).toBeLessThan(s.monthlyAverage);
    expect(s.likelyRange[1]).toBeGreaterThan(s.monthlyAverage);
  });

  it('flags a rising trend and fills zero months', () => {
    const s = computeCategoryStat('x', [0, 0, 0, 0, 0, 0, 0, 0, 0, 10000, 20000, 30000]);
    expect(s.trend).toBe('RISING');
    expect(s.min).toBe(0);
    expect(s.activeMonths).toBe(3);
    expect(s.confidence).toBe('LOW');
  });

  it('reports INSUFFICIENT_DATA with fewer than 2 active months', () => {
    expect(computeCategoryStat('x', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5000]).confidence).toBe('INSUFFICIENT_DATA');
  });

  it('classifies trend by a significant regression slope, not a two-bucket ratio', () => {
    const rise = Array.from({ length: 12 }, (_, i) => (100 + 10 * i) * 100); // steady climb
    const fall = Array.from({ length: 12 }, (_, i) => (210 - 10 * i) * 100); // steady decline
    const spike = [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 120].map((x) => x * 1000); // 11 flat + 1 lump
    const noisy = [12, 8, 11, 9, 13, 7, 12, 8, 11, 9, 13, 7].map((x) => x * 1000); // oscillates, no drift
    expect(computeCategoryStat('rise', rise).trend).toBe('RISING');
    expect(computeCategoryStat('fall', fall).trend).toBe('FALLING');
    expect(computeCategoryStat('spike', spike).trend).toBe('STABLE'); // lone spike isn't a trend (was RISING under the old ratio)
    expect(computeCategoryStat('noisy', noisy).trend).toBe('STABLE');
  });

  it('scores a contiguous season high, but flat/noise/one-off spend ~0', () => {
    const season = [1, 1, 1, 1, 1, 8, 8, 8, 1, 1, 1, 1].map((x) => x * 10_000); // three adjacent high months
    expect(computeCategoryStat('flat', Array(12).fill(10_000)).seasonalityStrength).toBe(0);
    expect(computeCategoryStat('spike', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 120_000]).seasonalityStrength).toBe(0); // lone one-off, not a season
    expect(computeCategoryStat('noise', [0, 100_000, 0, 100_000, 0, 100_000, 0, 100_000, 0, 100_000, 0, 100_000]).seasonalityStrength).toBe(0); // alternating noise
    expect(computeCategoryStat('season', season).seasonalityStrength).toBeGreaterThan(0.3);
  });

  it('names the peak month when the month keys are supplied', () => {
    const months = ['2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07'];
    const season = [1, 1, 1, 1, 1, 8, 8, 8, 1, 1, 1, 1].map((x) => x * 10_000); // peak block starts at index 5 -> 2026-01
    expect(computeCategoryStat('season', season, months).peakMonth).toBe('January');
    expect(computeCategoryStat('flat', Array(12).fill(10_000), months).peakMonth).toBeNull();
  });
});

describe('analyseSavings', () => {
  it('nets deposits against withdrawals (spec §11)', () => {
    const easy = acc({ id: 'easy', accountType: 'SAVINGS' });
    const txns = WINDOW.flatMap((mk) => [
      txn({ accountId: 'easy', amount: 50_000, date: `${mk}-26`, transactionType: 'TRANSFER' }),
      txn({ accountId: 'easy', amount: -28_000, date: `${mk}-12`, transactionType: 'TRANSFER' }),
    ]);
    const s = analyseSavings(snap({ asOf: '2026-08-15', accounts: [easy], transactions: txns }));
    expect(s.depositsPerMonth).toBe(50_000);
    expect(s.withdrawalsPerMonth).toBe(28_000);
    expect(s.netPerMonth).toBe(22_000);
    expect(s.withdrawalRatePct).toBe(56);
    expect(s.confidence).toBe('HIGH');
  });
});

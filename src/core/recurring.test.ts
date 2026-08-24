import { describe, it, expect } from 'vitest';
import { detectRecurring } from './recurring';
import { txn, snap } from './testkit';
import { addDaysISO } from './dates';

describe('detectRecurring', () => {
  it('detects a fixed monthly subscription with a next date', () => {
    const txns = Array.from({ length: 12 }, (_, i) =>
      txn({ merchant: 'Netflix', amount: -1599, date: `2026-${String(i + 1).padStart(2, '0')}-12`, transactionType: 'EXPENSE' }),
    );
    const series = detectRecurring(snap({ asOf: '2026-12-20', transactions: txns }));
    const nf = series.find((s) => s.key === 'netflix')!;
    expect(nf.frequency).toBe('MONTHLY');
    expect(nf.expectedAmount).toBe(1599);
    expect(nf.direction).toBe('EXPENSE');
    expect(nf.isVariable).toBe(false);
    expect(nf.confidence).toBeGreaterThan(80);
    expect(nf.nextExpectedDate).toBe('2027-01-12');
  });

  it('detects a weekly cadence', () => {
    const txns = Array.from({ length: 8 }, (_, i) =>
      txn({ merchant: 'PureGym', amount: -1000, date: addDaysISO('2026-01-05', i * 7), transactionType: 'EXPENSE' }),
    );
    const s = detectRecurring(snap({ asOf: '2026-04-01', transactions: txns })).find((x) => x.key === 'puregym')!;
    expect(s.frequency).toBe('WEEKLY');
  });

  it('flags variable recurring amounts', () => {
    const amounts = [-13000, -15200, -11000, -16800, -12500, -14000];
    const txns = amounts.map((a, i) => txn({ merchant: 'Octopus Energy', amount: a, date: `2026-${String(i + 1).padStart(2, '0')}-06`, transactionType: 'EXPENSE' }));
    const s = detectRecurring(snap({ asOf: '2026-08-01', transactions: txns })).find((x) => x.key === 'octopus energy')!;
    expect(s.isVariable).toBe(true);
    expect(s.amountMax).toBeGreaterThan(s.amountMin);
  });

  it('ignores merchants with too few occurrences', () => {
    const txns = [
      txn({ merchant: 'Rare Shop', amount: -500, date: '2026-01-01' }),
      txn({ merchant: 'Rare Shop', amount: -500, date: '2026-02-01' }),
    ];
    expect(detectRecurring(snap({ asOf: '2026-06-01', transactions: txns })).find((x) => x.key === 'rare shop')).toBeUndefined();
  });
});

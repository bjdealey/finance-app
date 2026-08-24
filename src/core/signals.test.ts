import { describe, it, expect } from 'vitest';
import { computeSignals } from './signals';
import { acc, txn, snap } from './testkit';

describe('computeSignals', () => {
  it('computes the weekend multiplier and gates on insufficient data', () => {
    // Jan 2026: 3 Jan = Sat, 4 Jan = Sun; 5-9 Jan = Mon-Fri. asOf March so Jan is in-window.
    const txns = [
      txn({ amount: -10_000, date: '2026-01-03', transactionType: 'EXPENSE' }),
      txn({ amount: -10_000, date: '2026-01-04', transactionType: 'EXPENSE' }),
      ...['05', '06', '07', '08', '09'].map((d) => txn({ amount: -2_000, date: `2026-01-${d}`, transactionType: 'EXPENSE' })),
    ];
    const weekend = computeSignals(snap({ asOf: '2026-03-01', transactions: txns })).find((s) => s.id === 'weekend_spending_multiplier')!;
    expect(weekend.value).toBeCloseTo(5, 1); // (20000/10000)*2.5
    expect(weekend.confidence).toBe('INSUFFICIENT_DATA'); // only 7 spend txns
  });

  it('detects a post-payday spike vs the lean pre-payday days', () => {
    const months = ['2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07'];
    const txns = months.flatMap((mk) => [
      txn({ amount: 300_000, date: `${mk}-25`, transactionType: 'INCOME' }),
      txn({ amount: -5_000, date: `${mk}-26`, transactionType: 'EXPENSE' }),
      txn({ amount: -3_000, date: `${mk}-27`, transactionType: 'EXPENSE' }),
      txn({ amount: -4_000, date: `${mk}-22`, transactionType: 'EXPENSE' }),
    ]);
    const sig = computeSignals(snap({ asOf: '2026-08-15', transactions: txns })).find((s) => s.id === 'post_payday_spending_multiplier')!;
    expect(sig.value).toBe(2); // post (8000) / pre (4000)
  });

  it('surfaces the savings withdrawal rate', () => {
    const easy = acc({ id: 'easy', accountType: 'SAVINGS' });
    const txns = ['2026-01', '2026-02', '2026-03'].flatMap((mk) => [
      txn({ accountId: 'easy', amount: 50_000, date: `${mk}-26`, transactionType: 'TRANSFER' }),
      txn({ accountId: 'easy', amount: -25_000, date: `${mk}-12`, transactionType: 'TRANSFER' }),
    ]);
    const sig = computeSignals(snap({ asOf: '2026-05-01', accounts: [easy], transactions: txns })).find((s) => s.id === 'savings_withdrawal_rate')!;
    expect(sig.value).toBe(50);
    expect(sig.unit).toBe('PERCENT');
  });
});

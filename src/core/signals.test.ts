import { describe, it, expect } from 'vitest';
import { computeSignals } from './signals';
import { acc, txn, snap, cat } from './testkit';

const MONTHS = ['2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07'];

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

  it('reports subscriptions as a share of spending', () => {
    const cats = [cat({ id: 'subs', name: 'Subscriptions' }), cat({ id: 'gro', name: 'Groceries' })];
    const txns = MONTHS.flatMap((mk) => [
      txn({ amount: -1_000, date: `${mk}-12`, transactionType: 'EXPENSE', categoryId: 'subs' }),
      txn({ amount: -9_000, date: `${mk}-05`, transactionType: 'EXPENSE', categoryId: 'gro' }),
    ]);
    const sig = computeSignals(snap({ asOf: '2026-08-15', categories: cats, transactions: txns })).find((s) => s.id === 'subscription_usage')!;
    expect(sig.value).toBe(10); // 1000 / 10000
    expect(sig.unit).toBe('PERCENT');
  });

  it('flags how often a credit-card balance carried (interest charged)', () => {
    const card = acc({ id: 'cc', accountType: 'CREDIT_CARD' });
    const txns = MONTHS.flatMap((mk, i) => (i < 6 ? [txn({ accountId: 'cc', amount: -500, date: `${mk}-01`, transactionType: 'INTEREST' })] : []));
    const sig = computeSignals(snap({ asOf: '2026-08-15', accounts: [card], transactions: txns })).find((s) => s.id === 'credit_card_payment_behaviour')!;
    expect(sig.value).toBe(50); // interest charged in 6 of 12 months
  });

  it('computes the summer travel multiplier', () => {
    const cats = [cat({ id: 'trv', name: 'Travel' })];
    const txns = MONTHS.map((mk) => {
      const summer = [6, 7, 8].includes(+mk.slice(5, 7));
      return txn({ amount: summer ? -40_000 : -10_000, date: `${mk}-15`, transactionType: 'EXPENSE', categoryId: 'trv' });
    });
    const sig = computeSignals(snap({ asOf: '2026-08-15', categories: cats, transactions: txns })).find((s) => s.id === 'travel_spending_multiplier')!;
    expect(sig.value).toBe(4); // summer 40000 / other 10000
  });

  it('flags grocery creep — recent spend above the typical month', () => {
    const cats = [cat({ id: 'gro', name: 'Groceries' })];
    const recent = new Set(['2026-05', '2026-06', '2026-07']);
    const txns = MONTHS.map((mk) => txn({ amount: recent.has(mk) ? -150_00 : -100_00, date: `${mk}-05`, transactionType: 'EXPENSE', categoryId: 'gro' }));
    const sig = computeSignals(snap({ asOf: '2026-08-15', categories: cats, transactions: txns })).find((s) => s.id === 'grocery_underestimation')!;
    expect(sig.value).toBe(50); // recent 150 vs median 100
    expect(sig.unit).toBe('PERCENT');
  });

  it('measures the seasonal swing in total monthly spend', () => {
    const lumpy = MONTHS.map((mk, i) => txn({ amount: i === 11 ? -1_000_00 : -100_00, date: `${mk}-10`, transactionType: 'EXPENSE' }));
    const flat = MONTHS.map((mk) => txn({ amount: -100_00, date: `${mk}-10`, transactionType: 'EXPENSE' }));
    const lumpySig = computeSignals(snap({ asOf: '2026-08-15', transactions: lumpy })).find((s) => s.id === 'seasonal_expense_pattern')!;
    const flatSig = computeSignals(snap({ asOf: '2026-08-15', transactions: flat })).find((s) => s.id === 'seasonal_expense_pattern')!;
    expect(lumpySig.value).toBeGreaterThan(0);
    expect(flatSig.value).toBe(0); // constant spend => no swing
    expect(lumpySig.unit).toBe('PERCENT');
  });

  it('computes the end-of-month spending multiplier', () => {
    // Equal magnitude late (day 26) vs early (day 10), but late is squeezed into ~8 days vs ~22.4.
    const txns = MONTHS.flatMap((mk) => [
      txn({ amount: -20_000, date: `${mk}-26`, transactionType: 'EXPENSE' }),
      txn({ amount: -20_000, date: `${mk}-10`, transactionType: 'EXPENSE' }),
    ]);
    const sig = computeSignals(snap({ asOf: '2026-08-15', transactions: txns })).find((s) => s.id === 'end_of_month_spending')!;
    expect(sig.value).toBe(2.8); // (1/8) / (1/22.4)
  });

  it('computes cash-buffer dependency as spend over income', () => {
    const txns = MONTHS.flatMap((mk) => [
      txn({ amount: 300_000, date: `${mk}-25`, transactionType: 'INCOME' }),
      txn({ amount: -240_000, date: `${mk}-10`, transactionType: 'EXPENSE' }),
    ]);
    const sig = computeSignals(snap({ asOf: '2026-08-15', transactions: txns })).find((s) => s.id === 'cash_buffer_dependency')!;
    expect(sig.value).toBe(80); // 240000 / 300000
    expect(sig.unit).toBe('PERCENT');
  });
});

import { describe, it, expect } from 'vitest';
import { runScenario } from './scenario';
import { acc, txn, snap, cat } from './testkit';

const MONTHS = ['2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07'];

function build() {
  const accounts = [
    acc({ id: 'main', accountType: 'CURRENT', accessType: 'INSTANT', openingBalance: 1_000_000 }),
    acc({ id: 'easy', accountType: 'SAVINGS', accessType: 'INSTANT', interestRateBps: 475, openingBalance: 500_000 }),
  ];
  const txns = MONTHS.flatMap((mk) => [
    txn({ accountId: 'main', merchant: 'ACME', amount: 390_000, date: `${mk}-25`, transactionType: 'INCOME' }),
    txn({ accountId: 'main', merchant: 'Rent', amount: -145_000, date: `${mk}-01`, transactionType: 'EXPENSE', categoryId: 'rent' }),
    txn({ accountId: 'main', merchant: 'Transfer', amount: -50_000, date: `${mk}-26`, transactionType: 'TRANSFER', transferGroupId: `g${mk}` }),
    txn({ accountId: 'easy', merchant: 'Transfer', amount: 50_000, date: `${mk}-26`, transactionType: 'TRANSFER', transferGroupId: `g${mk}` }),
  ]);
  return snap({ asOf: '2026-08-10', accounts, transactions: txns, categories: [cat({ id: 'rent', name: 'Rent' })] });
}

describe('runScenario', () => {
  const s = build();
  const txnCountBefore = s.transactions.length;

  it('does not mutate the snapshot', () => {
    runScenario(s, [{ kind: 'INCOME', monthly: 50_000 }]);
    runScenario(s, [{ kind: 'ONE_OFF', amount: 999_999 }]);
    expect(s.transactions.length).toBe(txnCountBefore);
  });

  it('reflects a salary increase in surplus and annual figures', () => {
    const r = runScenario(s, [{ kind: 'INCOME', monthly: 50_000 }]);
    expect(r.scenario.monthlyIncome).toBe(r.baseline.monthlyIncome + 50_000);
    expect(r.difference.monthlySurplus).toBe(50_000);
    expect(r.difference.annualSurplus).toBe(600_000);
  });

  it('reflects a spending cut', () => {
    const r = runScenario(s, [{ kind: 'SPEND', monthly: -6_000 }]); // trim £60/month
    expect(r.difference.monthlySpend).toBe(-6_000);
    expect(r.difference.annualSurplus).toBe(72_000);
  });

  it('flags a large one-off shortening the runway', () => {
    const r = runScenario(s, [{ kind: 'ONE_OFF', amount: 400_000 }]);
    expect(r.scenario.runwayMonths).toBeLessThan(r.baseline.runwayMonths);
  });

  it('produces a stable baseline regardless of deltas', () => {
    const a = runScenario(s, [{ kind: 'INCOME', monthly: 10_000 }]).baseline;
    const b = runScenario(s, [{ kind: 'SPEND', monthly: 99_000 }]).baseline;
    expect(a).toEqual(b);
  });
});

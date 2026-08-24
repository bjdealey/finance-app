import { describe, it, expect } from 'vitest';
import { runScenario } from './scenario';
import { forecast } from './forecast';
import { acc, txn, snap, cat, goal } from './testkit';

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

  it('derives cashflow impact from a real forecast re-run, not analytic arithmetic (spec §21)', () => {
    const r = runScenario(s, [{ kind: 'SPEND', monthly: 6_000 }]); // +£60/mo
    // The baseline is the actual 12-month forecast on the untouched snapshot, not 12x(income-spend).
    expect(r.cashflowImpact.baselineProjectedBalance).toBe(forecast(s, 365).projectedBalance);
    // The scenario layers 12 months of the marginal flow onto that real path.
    expect(r.cashflowImpact.scenarioProjectedBalance).toBe(r.cashflowImpact.baselineProjectedBalance - 12 * 6_000);
  });

  it('flags a scenario whose projected balance dips negative within the year', () => {
    const r = runScenario(s, [{ kind: 'ONE_OFF', amount: 6_000_000 }]); // £60k one-off vs ~£33k in the account
    expect(r.cashflowImpact.scenarioGoesNegative).toBe(true);
    expect(r.riskFlags).toContain('FORECAST_DIPS_NEGATIVE');
  });

  // Regression: a goal with no recent contributions must report null ("not on this pace"), not
  // remaining-in-pence. The old Math.max(1, recentMonthly) floored the divisor to 1p, so a £2,800
  // shortfall came out as 280,000 "months". A savings delta applied to the top goal must still give
  // a finite figure, and an already-funded goal keeps its normal projection.
  it('reports null months for an unfunded goal, finite once a savings delta funds it', () => {
    const accounts = [
      acc({ id: 'main', accountType: 'CURRENT', accessType: 'INSTANT', openingBalance: 1_000_000 }),
      acc({ id: 'easy', accountType: 'SAVINGS', accessType: 'INSTANT', openingBalance: 500_000 }),
      acc({ id: 'pot', accountType: 'SAVINGS', accessType: 'INSTANT', openingBalance: 120_000 }),
    ];
    const txns = MONTHS.flatMap((mk) => [
      txn({ accountId: 'main', amount: 390_000, date: `${mk}-25`, transactionType: 'INCOME' }),
      txn({ accountId: 'main', amount: -50_000, date: `${mk}-26`, transactionType: 'TRANSFER', transferGroupId: `g${mk}` }),
      txn({ accountId: 'easy', amount: 50_000, date: `${mk}-26`, transactionType: 'TRANSFER', transferGroupId: `g${mk}` }),
    ]);
    const goals = [
      goal({ id: 'pot-goal', name: 'Holiday', linkedAccountId: 'pot', targetAmount: 400_000, targetDate: '2027-08-01', priority: 1 }),
      goal({ id: 'easy-goal', name: 'Buffer', linkedAccountId: 'easy', targetAmount: 2_000_000, targetDate: '2027-08-01', priority: 100 }),
    ];
    const s2 = snap({ asOf: '2026-08-10', accounts, transactions: txns, goals });

    const r = runScenario(s2, [{ kind: 'SAVINGS', monthly: 35_000 }]); // +£350/mo → the top-priority goal (pot)
    const pot = r.goalImpact.find((g) => g.goalId === 'pot-goal')!;
    const easy = r.goalImpact.find((g) => g.goalId === 'easy-goal')!;

    expect(pot.baselineMonths).toBeNull(); // no recent contributions → not on this pace
    expect(pot.scenarioMonths).toBe(8); // ceil(280000 / 35000)
    expect(easy.baselineMonths).toBe(18); // funded path still finite: ceil(900000 / 50000)
  });
});

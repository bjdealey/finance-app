import { describe, it, expect } from 'vitest';
import { computeFinancialState } from './state';
import { forecast } from './forecast';
import { computeLiquidity } from './liquidity';
import { optimize } from './optimise';
import { buildRecommendations } from './recommend';
import { analyseCategories } from './behaviour';
import { goalStatuses } from './goals';
import { acc, txn, snap, cat, rule, goal } from './testkit';
import type { FinancialSnapshot } from './types';

const MONTHS = ['2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07'];
const REST = ['Dishoom', 'Nandos', 'Wagamama', 'Franco', 'Pizza', 'Ivy', 'Hawksmoor', 'Padella', 'Barrafina', 'Gymkhana', 'Sabor', 'Brat'];

function buildSnapshot(): FinancialSnapshot {
  const accounts = [
    acc({ id: 'main', name: 'Main Current', accountType: 'CURRENT', accessType: 'INSTANT', openingBalance: 1_000_000 }),
    acc({ id: 'easy', name: 'Easy Access Saver', accountType: 'SAVINGS', accessType: 'INSTANT', interestRateBps: 475, openingBalance: 500_000 }),
    acc({ id: 'isa', name: 'Cash ISA', accountType: 'CASH_ISA', accessType: 'NOTICE', interestRateBps: 490, openingBalance: 800_000 }),
    acc({ id: 'emg', name: 'Emergency Fund', accountType: 'SAVINGS', accessType: 'INSTANT', interestRateBps: 410, openingBalance: 300_000 }),
    acc({ id: 'amex', name: 'Amex', accountType: 'CREDIT_CARD', interestRateBps: 2290, creditLimit: 500_000, openingBalance: -200_000 }),
  ];
  const txns = MONTHS.flatMap((mk, i) => [
    txn({ accountId: 'main', merchant: 'ACME Payroll', amount: 390_000, date: `${mk}-25`, transactionType: 'INCOME' }),
    txn({ accountId: 'main', merchant: 'Property Mgmt', amount: -145_000, date: `${mk}-01`, transactionType: 'EXPENSE', categoryId: 'rent' }),
    txn({ accountId: 'main', merchant: REST[i], amount: -25_000, date: `${mk}-15`, transactionType: 'EXPENSE', categoryId: 'rest' }),
    txn({ accountId: 'main', merchant: 'Transfer to savings', amount: -50_000, date: `${mk}-26`, transactionType: 'TRANSFER', transferGroupId: `g-${mk}` }),
    txn({ accountId: 'easy', merchant: 'Transfer to savings', amount: 50_000, date: `${mk}-26`, transactionType: 'TRANSFER', transferGroupId: `g-${mk}` }),
  ]);
  return snap({
    asOf: '2026-08-10',
    accounts,
    transactions: txns,
    categories: [cat({ id: 'rent', name: 'Rent' }), cat({ id: 'rest', name: 'Restaurants' })],
    // A goal that's behind pace (needs ~£3.1k/mo, getting ~£500) so GOAL_CONTRIBUTION is exercised.
    goals: [goal({ name: 'House Deposit', targetAmount: 3_000_000, targetDate: '2027-02-10', linkedAccountId: 'easy', priority: 10 })],
    userRules: [
      rule({ ruleType: 'MIN_CURRENT_BALANCE', params: { amountPence: 150_000 } }),
      rule({ ruleType: 'EMERGENCY_MONTHS', params: { months: 3 } }),
      rule({ ruleType: 'PREFER_INSTANT_ACCESS', params: {} }),
    ],
  });
}

describe('financial pipeline', () => {
  const s = buildSnapshot();
  const state = computeFinancialState(s);
  const f30 = forecast(s, 30);
  const liquidity = computeLiquidity(s, state, f30);
  const optimisation = optimize(s, state, liquidity);
  const recs = buildRecommendations({ snapshot: s, state, liquidity, optimisation, goals: goalStatuses(s), categoryStats: analyseCategories(s) });

  it('finds a positive surplus and never over-allocates it (spec §40)', () => {
    expect(liquidity.surplusCash).toBeGreaterThan(0);
    const moved = optimisation.allocations
      .filter((a) => a.kind !== 'BUFFER')
      .reduce((sum, a) => sum + a.amount, 0);
    expect(moved).toBeLessThanOrEqual(liquidity.surplusCash);
    const total = optimisation.allocations.reduce((sum, a) => sum + a.amount, 0);
    expect(total).toBeLessThanOrEqual(liquidity.surplusCash);
  });

  it('prioritises clearing high-cost debt', () => {
    const debt = optimisation.allocations.find((a) => a.kind === 'PAY_DEBT');
    expect(debt).toBeTruthy();
    expect(debt!.amount).toBeLessThanOrEqual(200_000); // never more than owed
    expect(recs[0].type).toBe('PAY_DEBT'); // highest priority
  });

  it('routes savings to the instant-access account when PREFER_INSTANT_ACCESS is set', () => {
    const savings = optimisation.allocations.find((a) => a.kind === 'SAVINGS');
    expect(savings?.destinationAccountId).toBe('easy'); // not the higher-rate but NOTICE-access ISA
  });

  it('closes the emergency-fund gap before generic savings', () => {
    expect(liquidity.emergencyFundGap).toBeGreaterThan(0);
    expect(optimisation.allocations.some((a) => a.kind === 'EMERGENCY_FUND')).toBe(true);
  });

  it('gives every recommendation the full four-part explanation trace (spec §19)', () => {
    expect(recs.length).toBeGreaterThan(0);
    const NEEDS_WHY_ACCOUNT = new Set(['PAY_DEBT', 'MOVE_CASH', 'GOAL_CONTRIBUTION']);
    for (const r of recs) {
      expect(r.explanation.what.length).toBeGreaterThan(0);
      expect(r.explanation.why.length).toBeGreaterThan(0);
      expect((r.explanation.whatIfIgnored ?? '').length).toBeGreaterThan(0); // §19: "what happens if I don't?"
      if (NEEDS_WHY_ACCOUNT.has(r.type) && r.destinationAccountId) {
        expect((r.explanation.whyThisAccount ?? '').length).toBeGreaterThan(0); // §19: "why this account?"
      }
      expect(['INSUFFICIENT_DATA', 'LOW', 'MEDIUM', 'HIGH']).toContain(r.explanation.confidence);
    }
    // The behind-target goal is exercised here, so GOAL_CONTRIBUTION's trace is covered too.
    expect(recs.some((r) => r.type === 'GOAL_CONTRIBUTION')).toBe(true);
    const debtRec = recs.find((r) => r.type === 'PAY_DEBT')!;
    expect(debtRec.expectedBenefit?.aprAvoidedPence).toBeGreaterThan(0);
  });

  it('computes coherent savings-rate metrics', () => {
    expect(state.monthlyIncome).toBeGreaterThan(0);
    expect(state.grossSavingsRate).toBeGreaterThanOrEqual(state.netSavingsRate);
  });
});

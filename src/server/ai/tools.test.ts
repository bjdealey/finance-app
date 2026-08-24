import { describe, it, expect } from 'vitest';
import { analyseFinances } from '@/core/analyse';
import { runTool } from './tools';
import { acc, txn, snap, cat, rule } from '@/core/testkit';

const MONTHS = ['2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07'];

function build() {
  const accounts = [
    acc({ id: 'main', name: 'Main', accountType: 'CURRENT', accessType: 'INSTANT', openingBalance: 1_000_000 }),
    acc({ id: 'easy', name: 'Easy Access', accountType: 'SAVINGS', accessType: 'INSTANT', interestRateBps: 475, openingBalance: 500_000 }),
    acc({ id: 'emg', name: 'Emergency Fund', accountType: 'SAVINGS', accessType: 'INSTANT', interestRateBps: 410, openingBalance: 300_000 }),
    acc({ id: 'amex', name: 'Amex', accountType: 'CREDIT_CARD', interestRateBps: 2290, creditLimit: 500_000, openingBalance: -200_000 }),
  ];
  const txns = MONTHS.map((mk) => [
    txn({ accountId: 'main', merchant: 'ACME', amount: 390_000, date: `${mk}-25`, transactionType: 'INCOME' }),
    txn({ accountId: 'main', merchant: 'Rent', amount: -145_000, date: `${mk}-01`, transactionType: 'EXPENSE', categoryId: 'rent' }),
  ]).flat();
  return snap({
    asOf: '2026-08-10',
    accounts,
    transactions: txns,
    categories: [cat({ id: 'rent', name: 'Rent' })],
    userRules: [rule({ ruleType: 'MIN_CURRENT_BALANCE', params: { amountPence: 150_000 } }), rule({ ruleType: 'EMERGENCY_MONTHS', params: { months: 3 } })],
  });
}

describe('AI tools (the LLM data boundary)', () => {
  const a = analyseFinances(build());

  it('returns GBP-formatted state so the model never does arithmetic', () => {
    const r = runTool('get_financial_state', {}, a) as Record<string, string>;
    expect(r.totalCash).toMatch(/^£/);
    expect(r.netSavingsRate).toMatch(/%$/);
  });

  it('returns a forecast for the requested horizon', () => {
    const r = runTool('get_cashflow_forecast', { horizon_days: 30 }, a) as { horizonDays: number; projectedBalance: string };
    expect(r.horizonDays).toBe(30);
    expect(r.projectedBalance).toMatch(/£/);
  });

  it('enumerates recommendations and explains one by index', () => {
    const recs = runTool('get_recommendations', {}, a) as { recommendations: unknown[] };
    expect(Array.isArray(recs.recommendations)).toBe(true);
    expect(recs.recommendations.length).toBeGreaterThan(0);
    const ex = runTool('explain_recommendation', { index: 0 }, a) as { what: string };
    expect(ex.what.length).toBeGreaterThan(0);
  });

  it('runs a scenario and returns baseline vs scenario', () => {
    const r = runTool('run_scenario', { income_change_monthly: 500 }, a) as { baseline: { monthlyIncome: string }; change: { annualSurplus: string } };
    expect(r.baseline.monthlyIncome).toMatch(/^£/);
    expect(r.change.annualSurplus).toMatch(/£/);
  });

  it('returns an error object for an unknown tool', () => {
    expect(runTool('does_not_exist', {}, a)).toHaveProperty('error');
  });
});

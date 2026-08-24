import { describe, it, expect } from 'vitest';
import { computeFinancialState } from './state';
import { forecast } from './forecast';
import { computeLiquidity } from './liquidity';
import { computeBalances } from './ledger';
import { acc, txn, snap, cat, rule } from './testkit';

const MONTHS = ['2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07'];

// Spec §15: cash must be split by purpose, not treated as one interchangeable pot.
describe('computeLiquidity — cash split into four purpose buckets (spec §15)', () => {
  const accounts = [
    acc({ id: 'main', name: 'Main', accountType: 'CURRENT', accessType: 'INSTANT', openingBalance: 300_000 }),
    acc({ id: 'saver', name: 'Saver', accountType: 'SAVINGS', accessType: 'INSTANT', interestRateBps: 475, openingBalance: 500_000 }),
    acc({ id: 'emg', name: 'Emergency Fund', accountType: 'SAVINGS', accessType: 'INSTANT', interestRateBps: 410, openingBalance: 400_000 }),
    acc({ id: 'fixed', name: 'Fixed Saver', accountType: 'SAVINGS', accessType: 'FIXED_TERM', interestRateBps: 520, openingBalance: 200_000 }),
    acc({ id: 'invest', name: 'S&S ISA', accountType: 'INVESTMENT', accessType: 'RESTRICTED', openingBalance: 1_000_000 }),
  ];
  const txns = MONTHS.flatMap((mk) => [
    txn({ accountId: 'main', merchant: 'Payroll', amount: 300_000, date: `${mk}-25`, transactionType: 'INCOME' }),
    txn({ accountId: 'main', merchant: 'Landlord', amount: -100_000, date: `${mk}-01`, transactionType: 'EXPENSE', categoryId: 'rent' }),
  ]);
  const s = snap({
    asOf: '2026-08-10',
    accounts,
    transactions: txns,
    categories: [cat({ id: 'rent', name: 'Rent' })],
    userRules: [rule({ ruleType: 'EMERGENCY_MONTHS', params: { months: 3 } })],
  });
  const liq = computeLiquidity(s, computeFinancialState(s), forecast(s, 30));
  const bal = new Map(computeBalances(s).map((b) => [b.accountId, b.balance]));
  const positive = (id: string) => Math.max(0, bal.get(id) ?? 0);

  it('classifies investments and fixed-term savings as long-term capital', () => {
    expect(liq.buckets.longTermCapital).toBe(positive('invest') + positive('fixed'));
  });

  it('holds an emergency reserve capped at the target, separate from spare cash', () => {
    expect(liq.emergencyFundTarget).toBeGreaterThan(0); // 3 x essential rent
    expect(liq.buckets.emergencyReserve).toBe(Math.min(liq.emergencyFundCurrent, liq.emergencyFundTarget));
  });

  it('partitions total cash exactly — the four buckets sum to it, none negative', () => {
    const { emergencyReserve, nearTermBuffer, discretionaryCash, longTermCapital } = liq.buckets;
    for (const v of [emergencyReserve, nearTermBuffer, discretionaryCash, longTermCapital]) expect(v).toBeGreaterThanOrEqual(0);
    const totalCash = ['main', 'saver', 'emg', 'fixed', 'invest'].reduce((sum, id) => sum + positive(id), 0);
    expect(emergencyReserve + nearTermBuffer + discretionaryCash + longTermCapital).toBe(totalCash);
  });
});

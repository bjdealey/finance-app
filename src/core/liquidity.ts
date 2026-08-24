import type { FinancialSnapshot, Account } from './types';
import type { FinancialState } from './state';
import type { Forecast } from './forecast';
import { computeBalances } from './ledger';

export interface Liquidity {
  requiredCashBuffer: number; // cushion to keep in current accounts
  currentAccountCash: number;
  thirtyDayTrough: number; // conservative low point of current-account cash over 30 days
  knownUpcomingExpenses: number; // committed (recurring) outflows in next 30 days
  expectedNearTermSpending: number; // predicted discretionary in next 30 days
  emergencyFundTarget: number;
  emergencyFundCurrent: number;
  emergencyFundGap: number;
  surplusCash: number; // safely movable out of current accounts right now
  // Spec §15: the same cash split by PURPOSE, not by where it sits — cash is not all interchangeable.
  // The four buckets partition total positive cash exactly (they sum to it).
  buckets: {
    emergencyReserve: number; // earmarked emergency fund, capped at target
    nearTermBuffer: number; // required buffer + known upcoming + predicted near-term spend
    discretionaryCash: number; // accessible cash beyond the above — genuinely spare
    longTermCapital: number; // investments + fixed-term/restricted savings — not available near-term
  };
}

function userMinCurrent(snapshot: FinancialSnapshot): number | null {
  const rule = snapshot.userRules.find((r) => r.active && r.ruleType === 'MIN_CURRENT_BALANCE');
  const amt = rule?.params?.amountPence;
  return typeof amt === 'number' ? amt : null;
}

function emergencyMonths(snapshot: FinancialSnapshot): number {
  const rule = snapshot.userRules.find((r) => r.active && r.ruleType === 'EMERGENCY_MONTHS');
  const m = rule?.params?.months;
  return typeof m === 'number' && m > 0 ? m : 3;
}

// Requires a 30-day forecast (pass forecast(snapshot, 30)). Surplus is conservative: even at the
// lowest projected point over the next 30 days, moving `surplusCash` still leaves the buffer intact.
export function computeLiquidity(snapshot: FinancialSnapshot, state: FinancialState, forecast30: Forecast): Liquidity {
  const balances = new Map(computeBalances(snapshot).map((b) => [b.accountId, b.balance]));
  const bal = (id: string) => balances.get(id) ?? 0;

  const requiredCashBuffer = userMinCurrent(snapshot) ?? Math.round(0.5 * state.expectedMonthlySpend);

  // Running-balance trough over the 30-day forecast, then shave off predicted uncertainty.
  let running = forecast30.openingBalance;
  let trough = running;
  for (const item of forecast30.items) {
    running += item.amount;
    if (running < trough) trough = running;
  }
  const predictedBand = forecast30.high - forecast30.projectedBalance; // uncertainty of predicted spend
  const conservativeTrough = trough - predictedBand;

  const knownUpcomingExpenses = -forecast30.items
    .filter((i) => (i.source === 'RECURRING' || i.source === 'KNOWN' || i.source === 'USER_ENTERED') && i.amount < 0)
    .reduce((s, i) => s + i.amount, 0);
  const expectedNearTermSpending = -forecast30.items
    .filter((i) => i.source === 'PREDICTED')
    .reduce((s, i) => s + i.amount, 0);

  // Emergency fund: dedicated account(s) by name/purpose; target = essential spend × months.
  const emergencyAccounts = snapshot.accounts.filter(
    (a) => /emergency/i.test(a.name) || /emergency/i.test(a.purpose ?? ''),
  );
  const emergencyFundCurrent = emergencyAccounts.reduce((s, a) => s + bal(a.id), 0);
  const emergencyFundTarget = state.essentialMonthlySpend * emergencyMonths(snapshot);
  const emergencyFundGap = Math.max(0, emergencyFundTarget - emergencyFundCurrent);

  const surplusCash = Math.max(0, conservativeTrough - requiredCashBuffer);

  // Partition every pound of cash by purpose (spec §15), so nothing is shown as one interchangeable
  // "available" pot. Long-term = invested or locked; the accessible remainder splits into the emergency
  // reserve (up to target), the near-term spending buffer, then whatever is genuinely spare.
  const positiveBal = (id: string) => Math.max(0, bal(id));
  const assetAccounts = snapshot.accounts.filter((a) =>
    ['CURRENT', 'SAVINGS', 'CASH_ISA', 'INVESTMENT'].includes(a.accountType),
  );
  const isLocked = (a: Account) => a.accountType === 'INVESTMENT' || a.accessType === 'FIXED_TERM' || a.accessType === 'RESTRICTED';
  const totalCash = assetAccounts.reduce((s, a) => s + positiveBal(a.id), 0);
  const longTermCapital = assetAccounts.filter(isLocked).reduce((s, a) => s + positiveBal(a.id), 0);
  const accessible = totalCash - longTermCapital;
  const emergencyReserve = Math.min(Math.max(0, Math.min(emergencyFundCurrent, emergencyFundTarget)), accessible);
  const nearTermBuffer = Math.min(requiredCashBuffer + knownUpcomingExpenses + expectedNearTermSpending, accessible - emergencyReserve);
  const discretionaryCash = accessible - emergencyReserve - nearTermBuffer;

  return {
    requiredCashBuffer,
    currentAccountCash: state.currentAccountCash,
    thirtyDayTrough: trough,
    knownUpcomingExpenses,
    expectedNearTermSpending,
    emergencyFundTarget,
    emergencyFundCurrent,
    emergencyFundGap,
    surplusCash,
    buckets: { emergencyReserve, nearTermBuffer, discretionaryCash, longTermCapital },
  };
}

import type { FinancialSnapshot, ReasonCode, ConstraintCode } from './types';
import type { FinancialState } from './state';
import type { Liquidity } from './liquidity';
import { computeBalances } from './ledger';
import { isaAllowance } from './isa';

export type AllocationKind = 'PAY_DEBT' | 'EMERGENCY_FUND' | 'SAVINGS' | 'BUFFER';

export interface Allocation {
  kind: AllocationKind;
  destinationAccountId: string | null;
  destinationName: string;
  amount: number;
  reasonCodes: ReasonCode[];
  constraintsChecked: ConstraintCode[];
  score: number;
  meta: Record<string, number>;
}

export interface OptimisationResult {
  surplus: number;
  sourceAccountId: string | null;
  sourceName: string;
  allocations: Allocation[];
}

const HIGH_COST_APR_BPS = 1000; // 10%+

// Deterministic allocation of movable current-account surplus. Priority: clear high-cost debt,
// then close any emergency-fund gap, then park the rest in the best accessible savings, keeping a
// small discretionary buffer. Conservative: only ever allocates `liquidity.surplusCash`, which is
// already floored so the 30-day trough stays above the required buffer (spec §40).
export function optimize(snapshot: FinancialSnapshot, state: FinancialState, liquidity: Liquidity): OptimisationResult {
  const balances = new Map(computeBalances(snapshot).map((b) => [b.accountId, b.balance]));
  const bal = (id: string) => balances.get(id) ?? 0;

  const doNotTouch = new Set(
    snapshot.userRules
      .filter((r) => r.active && r.ruleType === 'DO_NOT_TOUCH_ACCOUNT')
      .map((r) => r.params?.accountId as string)
      .filter(Boolean),
  );
  const preferInstant = snapshot.userRules.some((r) => r.active && r.ruleType === 'PREFER_INSTANT_ACCESS');

  const source = snapshot.accounts
    .filter((a) => a.accountType === 'CURRENT' && !doNotTouch.has(a.id))
    .sort((a, b) => bal(b.id) - bal(a.id))[0];

  // Cap the movable amount at the SOURCE account's own balance. `surplusCash` is computed on the
  // aggregate current-account trough, so with several current accounts it can exceed any single
  // account's balance — and you can't move more cash out of an account than it holds (spec §40).
  // ponytail: sweeps only the single largest current account; a multi-account sweep would place the rest.
  const sourceBalance = source ? Math.max(0, bal(source.id)) : 0;
  const surplus = Math.min(liquidity.surplusCash, sourceBalance);
  const allocations: Allocation[] = [];
  if (!source || surplus <= 0) {
    return { surplus, sourceAccountId: source?.id ?? null, sourceName: source?.name ?? '', allocations };
  }

  // Keep ~10% of the surplus as extra discretionary headroom in the current account.
  const buffer = Math.round(0.1 * surplus);
  let left = surplus - buffer;

  // 1. High-cost debt (paying down APR beats any savings rate).
  for (const card of snapshot.accounts
    .filter((a) => a.accountType === 'CREDIT_CARD' && bal(a.id) < 0 && a.interestRateBps >= HIGH_COST_APR_BPS)
    .sort((a, b) => b.interestRateBps - a.interestRateBps)) {
    if (left <= 0) break;
    const amount = Math.min(left, -bal(card.id));
    if (amount <= 0) continue;
    allocations.push({
      kind: 'PAY_DEBT',
      destinationAccountId: card.id,
      destinationName: card.name,
      amount,
      reasonCodes: ['HIGH_COST_DEBT'],
      constraintsChecked: ['30_DAY_LIQUIDITY', 'DEBT_CONSTRAINT'],
      score: 100000 + card.interestRateBps,
      meta: { aprBps: card.interestRateBps },
    });
    left -= amount;
  }

  // 2. Emergency-fund gap.
  if (left > 0 && liquidity.emergencyFundGap > 0) {
    const emg = snapshot.accounts.find((a) => /emergency/i.test(a.name) || /emergency/i.test(a.purpose ?? ''));
    if (emg) {
      const amount = Math.min(left, liquidity.emergencyFundGap);
      allocations.push({
        kind: 'EMERGENCY_FUND',
        destinationAccountId: emg.id,
        destinationName: emg.name,
        amount,
        reasonCodes: ['EMERGENCY_FUND_GAP', 'LOW_LIQUIDITY'],
        constraintsChecked: ['EMERGENCY_FUND', '30_DAY_LIQUIDITY'],
        score: 90000,
        meta: { rateBps: emg.interestRateBps },
      });
      left -= amount;
    }
  }

  // 3. Remaining -> accessible savings/ISA by rate. Walk them best-first so that when an ISA's
  // remaining annual allowance can't absorb the whole surplus, the overflow lands in the next-best
  // non-ISA saver instead of silently exceeding the £20k limit (spec §16 tax treatment).
  if (left > 0) {
    let dests = snapshot.accounts.filter(
      (a) =>
        (a.accountType === 'SAVINGS' || a.accountType === 'CASH_ISA') &&
        (a.accessType === 'INSTANT' || a.accessType === 'NOTICE') &&
        !doNotTouch.has(a.id),
    );
    if (preferInstant) dests = dests.filter((a) => a.accessType === 'INSTANT');
    dests.sort((a, b) => b.interestRateBps - a.interestRateBps);
    let isaRemaining = isaAllowance(snapshot).remaining;
    for (const dest of dests) {
      if (left <= 0 || dest.interestRateBps <= source.interestRateBps) break; // sorted: nothing better follows
      const isIsa = dest.accountType === 'CASH_ISA' || dest.taxWrapper != null;
      const amount = isIsa ? Math.min(left, isaRemaining) : left;
      if (amount <= 0) continue; // ISA allowance exhausted -> fall through to the next saver
      const reasonCodes: ReasonCode[] = ['EXCESS_CURRENT_BALANCE', 'HIGHER_SAVINGS_RATE'];
      const constraintsChecked: ConstraintCode[] = ['30_DAY_LIQUIDITY', 'UPCOMING_COMMITMENTS', 'ACCOUNT_ACCESS'];
      if (isIsa) {
        reasonCodes.push('ISA_ALLOWANCE');
        constraintsChecked.push('ISA_ALLOWANCE');
      }
      if (preferInstant) constraintsChecked.push('USER_RULE');
      allocations.push({
        kind: 'SAVINGS',
        destinationAccountId: dest.id,
        destinationName: dest.name,
        amount,
        reasonCodes,
        constraintsChecked,
        score: dest.interestRateBps,
        meta: { rateBps: dest.interestRateBps, sourceRateBps: source.interestRateBps, ...(isIsa ? { isaRemainingAfter: isaRemaining - amount } : {}) },
      });
      left -= amount;
      if (isIsa) isaRemaining -= amount;
    }
  }

  // 4. Discretionary buffer (stays put) — plus anything that couldn't be placed.
  const kept = buffer + Math.max(0, left);
  if (kept > 0) {
    allocations.push({
      kind: 'BUFFER',
      destinationAccountId: source.id,
      destinationName: source.name,
      amount: kept,
      reasonCodes: ['DISCRETIONARY_BUFFER'],
      constraintsChecked: ['30_DAY_LIQUIDITY'],
      score: 0,
      meta: {},
    });
  }

  return { surplus, sourceAccountId: source.id, sourceName: source.name, allocations };
}

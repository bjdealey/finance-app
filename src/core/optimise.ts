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
// An emergency reserve guards against being forced onto high-cost credit in a shock, so it's worth
// almost as much as clearing high-cost debt you already owe (certain), and more than earning ordinary
// savings interest. Scored a hair under the high-cost band so existing debt is still cleared first.
const EMERGENCY_SCORE_BPS = HIGH_COST_APR_BPS - 1;

// A candidate destination for the surplus: the score that ranks it and the most it can absorb.
interface Candidate {
  score: number; // expected annual benefit in bps — the common currency the allocator ranks on
  cap: number; // most this destination can take (debt owed, emergency gap, or unbounded for savings)
  isIsa: boolean; // ISA destinations additionally share the annual allowance budget
  build: (amount: number) => Allocation;
}

// Deterministic scoring/constraint allocator (spec §16/§17). Every movable pound of current-account
// surplus is offered to a ranked list of candidate destinations and greedily placed best-score-first,
// subject to hard constraints. Score is a common "expected annual benefit in bps" scale — paying
// high-cost debt scores at the APR it avoids, an emergency top-up just under the high-cost band, a
// saving at the rate it earns — so the ordering (debt → emergency → savings → buffer) is an EMERGENT
// property of the scores, not a hardcoded waterfall. Conservative: only ever allocates
// `liquidity.surplusCash`, already floored so the 30-day trough stays above the required buffer (§40).
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

  // Cap the movable amount at the SOURCE account's own balance: `surplusCash` is computed on the
  // aggregate current-account trough, so with several current accounts it can exceed any single
  // account's balance, and you can't move out more than one account holds (spec §40).
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

  const candidates: Candidate[] = [];

  // High-cost debt: paying down an APR "returns" that APR, so it scores at the rate it avoids.
  for (const card of snapshot.accounts.filter(
    (a) => a.accountType === 'CREDIT_CARD' && bal(a.id) < 0 && a.interestRateBps >= HIGH_COST_APR_BPS,
  )) {
    candidates.push({
      score: card.interestRateBps,
      cap: -bal(card.id),
      isIsa: false,
      build: (amount) => ({
        kind: 'PAY_DEBT',
        destinationAccountId: card.id,
        destinationName: card.name,
        amount,
        reasonCodes: ['HIGH_COST_DEBT'],
        constraintsChecked: ['30_DAY_LIQUIDITY', 'DEBT_CONSTRAINT'],
        score: card.interestRateBps,
        meta: { aprBps: card.interestRateBps },
      }),
    });
  }

  // Emergency-fund gap: a required liquidity floor, scored just under high-cost debt.
  if (liquidity.emergencyFundGap > 0) {
    const emg = snapshot.accounts.find((a) => /emergency/i.test(a.name) || /emergency/i.test(a.purpose ?? ''));
    if (emg) {
      candidates.push({
        score: EMERGENCY_SCORE_BPS,
        cap: liquidity.emergencyFundGap,
        isIsa: false,
        build: (amount) => ({
          kind: 'EMERGENCY_FUND',
          destinationAccountId: emg.id,
          destinationName: emg.name,
          amount,
          reasonCodes: ['EMERGENCY_FUND_GAP', 'LOW_LIQUIDITY'],
          constraintsChecked: ['EMERGENCY_FUND', '30_DAY_LIQUIDITY'],
          score: EMERGENCY_SCORE_BPS,
          meta: { rateBps: emg.interestRateBps },
        }),
      });
    }
  }

  // Accessible savings/ISA: score at the rate earned, but only when it beats leaving the cash in the
  // current account. ISA destinations also share the annual allowance (enforced in the allocator).
  let savingsDests = snapshot.accounts.filter(
    (a) =>
      (a.accountType === 'SAVINGS' || a.accountType === 'CASH_ISA') &&
      (a.accessType === 'INSTANT' || a.accessType === 'NOTICE') &&
      !doNotTouch.has(a.id) &&
      a.interestRateBps > source.interestRateBps,
  );
  if (preferInstant) savingsDests = savingsDests.filter((a) => a.accessType === 'INSTANT');
  for (const dest of savingsDests) {
    const isIsa = dest.accountType === 'CASH_ISA' || dest.taxWrapper != null;
    candidates.push({
      score: dest.interestRateBps,
      cap: Number.POSITIVE_INFINITY,
      isIsa,
      build: (amount) => {
        const reasonCodes: ReasonCode[] = ['EXCESS_CURRENT_BALANCE', 'HIGHER_SAVINGS_RATE'];
        const constraintsChecked: ConstraintCode[] = ['30_DAY_LIQUIDITY', 'UPCOMING_COMMITMENTS', 'ACCOUNT_ACCESS'];
        if (isIsa) {
          reasonCodes.push('ISA_ALLOWANCE');
          constraintsChecked.push('ISA_ALLOWANCE');
        }
        if (preferInstant) constraintsChecked.push('USER_RULE');
        return {
          kind: 'SAVINGS',
          destinationAccountId: dest.id,
          destinationName: dest.name,
          amount,
          reasonCodes,
          constraintsChecked,
          score: dest.interestRateBps,
          meta: { rateBps: dest.interestRateBps, sourceRateBps: source.interestRateBps },
        };
      },
    });
  }

  // Greedily fund the highest-scoring destinations first, subject to the remaining surplus, each
  // destination's cap, and the shared ISA annual allowance across all ISA destinations.
  candidates.sort((a, b) => b.score - a.score);
  let isaRemaining = isaAllowance(snapshot).remaining;
  for (const c of candidates) {
    if (left <= 0) break;
    let amount = Math.min(left, c.cap);
    if (c.isIsa) amount = Math.min(amount, isaRemaining);
    if (amount <= 0) continue; // e.g. ISA allowance exhausted -> fall through to the next-best saver
    const alloc = c.build(amount);
    if (c.isIsa) {
      isaRemaining -= amount;
      alloc.meta.isaRemainingAfter = isaRemaining;
    }
    allocations.push(alloc);
    left -= amount;
  }

  // Discretionary buffer (stays put) — plus anything that couldn't be placed.
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

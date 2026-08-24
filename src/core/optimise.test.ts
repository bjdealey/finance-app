import { describe, it, expect } from 'vitest';
import { optimize } from './optimise';
import { acc, snap } from './testkit';
import type { FinancialState } from './state';
import type { Liquidity } from './liquidity';

// optimize() reads only snapshot + liquidity (state is unused), so we can fake state/liquidity.
const STATE = {} as FinancialState;
const liq = (surplusCash: number, extra: Partial<Liquidity> = {}): Liquidity =>
  ({ surplusCash, emergencyFundGap: 0, requiredCashBuffer: 0, ...extra } as Liquidity);

describe('optimize — never over-allocates a single source (spec §40)', () => {
  it('caps the move at the source current-account balance when aggregate surplus exceeds it', () => {
    const accounts = [
      acc({ id: 'main', name: 'Main', accountType: 'CURRENT', openingBalance: 300_000 }), // £3,000 (largest → source)
      acc({ id: 'joint', name: 'Joint', accountType: 'CURRENT', openingBalance: 250_000 }), // £2,500 (aggregate £5,500)
      acc({ id: 'saver', name: 'Saver', accountType: 'SAVINGS', accessType: 'INSTANT', interestRateBps: 480, openingBalance: 0 }),
    ];
    // Aggregate surplus (£5,000) is larger than the source account holds (£3,000).
    const result = optimize(snap({ accounts }), STATE, liq(500_000));

    expect(result.sourceAccountId).toBe('main');
    expect(result.surplus).toBeLessThanOrEqual(300_000); // capped at source balance
    const movedFromSource = result.allocations
      .filter((a) => a.kind !== 'BUFFER') // BUFFER stays put in the source
      .reduce((s, a) => s + a.amount, 0);
    expect(movedFromSource).toBeLessThanOrEqual(300_000);
  });

  it('is unchanged when the source holds more than the surplus', () => {
    const accounts = [
      acc({ id: 'main', name: 'Main', accountType: 'CURRENT', openingBalance: 900_000 }), // £9,000
      acc({ id: 'saver', name: 'Saver', accountType: 'SAVINGS', accessType: 'INSTANT', interestRateBps: 480, openingBalance: 0 }),
    ];
    const result = optimize(snap({ accounts }), STATE, liq(400_000)); // £4,000 surplus < source
    expect(result.surplus).toBe(400_000); // no cap applied
  });
});

describe('optimize — scoring drives the order (spec §17)', () => {
  it('ranks destinations by a real benefit-rate score, not a hardcoded waterfall or tier constants', () => {
    const accounts = [
      acc({ id: 'main', name: 'Main', accountType: 'CURRENT', interestRateBps: 50, openingBalance: 3_000_000 }),
      acc({ id: 'card', name: 'Card', accountType: 'CREDIT_CARD', interestRateBps: 2290, openingBalance: -100_000 }),
      acc({ id: 'emergency', name: 'Emergency Fund', accountType: 'SAVINGS', accessType: 'INSTANT', interestRateBps: 0, openingBalance: 0 }),
      acc({ id: 'saver', name: 'Saver', accountType: 'SAVINGS', accessType: 'INSTANT', interestRateBps: 500, openingBalance: 0 }),
    ];
    const result = optimize(snap({ accounts }), STATE, liq(1_000_000, { emergencyFundGap: 300_000 }));
    const moves = result.allocations.filter((a) => a.kind !== 'BUFFER');

    // Emitted in descending score order — the score actually selects the order (999 = emergency).
    expect(moves.map((a) => a.score)).toEqual([2290, 999, 500]);
    // Score is the genuine benefit rate in bps, not the old 100000/90000 tier constants.
    expect(moves.find((a) => a.kind === 'PAY_DEBT')!.score).toBe(2290); // the APR it avoids
    expect(moves.find((a) => a.kind === 'SAVINGS')!.score).toBe(500); // the rate it earns
    // Emergent priority: 22.9% debt > emergency reserve > 5% saver.
    expect(moves.map((a) => a.kind)).toEqual(['PAY_DEBT', 'EMERGENCY_FUND', 'SAVINGS']);
  });
});

describe('optimize — respects the ISA annual allowance (spec §16)', () => {
  it('caps an ISA move at the remaining allowance and overflows to the next-best saver', () => {
    const accounts = [
      acc({ id: 'main', name: 'Main', accountType: 'CURRENT', openingBalance: 5_000_000 }), // £50k source
      acc({ id: 'cisa', name: 'Cash ISA', accountType: 'CASH_ISA', accessType: 'INSTANT', interestRateBps: 500, taxWrapper: 'CASH_ISA', openingBalance: 0 }),
      acc({ id: 'easy', name: 'Easy Saver', accountType: 'SAVINGS', accessType: 'INSTANT', interestRateBps: 470, openingBalance: 0 }),
    ];
    // Already subscribed £19,000 this tax year -> only £1,000 of ISA room left.
    const priorIsa = { accountId: 'cisa', amount: 19_000_00, date: '2026-05-01', transactionType: 'TRANSFER' as const };
    const result = optimize(
      snap({ asOf: '2026-08-24', accounts, transactions: [{ ...priorIsa, id: 'p', currency: 'GBP', merchant: null, description: null, categoryId: null, status: 'POSTED', transferGroupId: null, source: 'SEED' }] }),
      STATE,
      liq(3_000_000), // £30k surplus, well over the £1k of ISA room
    );

    const isaMove = result.allocations.find((a) => a.destinationAccountId === 'cisa');
    const easyMove = result.allocations.find((a) => a.destinationAccountId === 'easy');
    expect(isaMove?.amount).toBe(1_000_00); // capped at remaining allowance
    expect(isaMove?.constraintsChecked).toContain('ISA_ALLOWANCE');
    expect(easyMove).toBeTruthy(); // overflow lands in the non-ISA saver
    expect((easyMove?.amount ?? 0)).toBeGreaterThan(0);
  });
});

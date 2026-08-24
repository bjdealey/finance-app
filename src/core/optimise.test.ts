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

import { describe, it, expect } from 'vitest';
import { debtPayoff, debtSummary } from './debt';
import { acc, snap } from './testkit';

describe('debtPayoff', () => {
  it('clears an interest-free balance in whole payments', () => {
    const p = debtPayoff(-1000_00, 0, 250_00); // £1,000 at 0% APR, £250/mo
    expect(p.clears).toBe(true);
    expect(p.monthsToClear).toBe(4);
    expect(p.totalInterest).toBe(0);
  });

  it('reports that a below-interest minimum payment never clears', () => {
    // The demo Amex: £2,453 at 22.9% APR, £25 minimum. Interest alone (~£46/mo) exceeds the payment.
    const p = debtPayoff(-2453_00, 2290, 25_00);
    expect(p.monthlyInterest).toBeGreaterThan(25_00);
    expect(p.clears).toBe(false);
    expect(p.monthsToClear).toBeNull();
    expect(p.totalInterest).toBeNull();
  });

  it('amortises a normal balance with interest', () => {
    const p = debtPayoff(-1000_00, 1200, 200_00); // £1,000 at 12% APR, £200/mo
    expect(p.clears).toBe(true);
    expect(p.monthsToClear).toBeGreaterThanOrEqual(5);
    expect(p.monthsToClear).toBeLessThanOrEqual(6);
    expect(p.totalInterest).toBeGreaterThan(0);
  });
});

describe('debtSummary', () => {
  it('summarises debt accounts with utilisation and payoff, most-expensive first', () => {
    const accounts = [
      acc({ id: 'amex', name: 'Amex', accountType: 'CREDIT_CARD', interestRateBps: 2290, creditLimit: 5000_00, minimumPayment: 25_00, openingBalance: -2453_00 }),
      acc({ id: 'barc', name: 'Barclaycard', accountType: 'CREDIT_CARD', interestRateBps: 1990, creditLimit: 3000_00, minimumPayment: 25_00, openingBalance: -180_00 }),
      acc({ id: 'main', name: 'Current', accountType: 'CURRENT', openingBalance: 500_00 }), // not debt
    ];
    const summary = debtSummary(snap({ accounts }));
    expect(summary.map((d) => d.accountId)).toEqual(['amex', 'barc']); // highest APR first, current excluded
    expect(summary[0].utilisationPct).toBe(49); // 2453 / 5000
    expect(summary[0].payoff?.clears).toBe(false); // £25 min never clears the Amex
  });
});

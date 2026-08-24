import { describe, it, expect } from 'vitest';
import { forecast, forecastHorizons } from './forecast';
import { acc, txn, snap } from './testkit';

// 12 monthly occurrences ending before asOf, so detectRecurring has a series with a future nextDate.
function monthly(merchant: string, amount: number, day: string, startYm: [number, number], type: 'INCOME' | 'EXPENSE', categoryId?: string) {
  const out = [];
  let [y, m] = startYm;
  for (let i = 0; i < 12; i++) {
    out.push(txn({ accountId: 'main', merchant, amount, date: `${y}-${String(m).padStart(2, '0')}-${day}`, transactionType: type, categoryId }));
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

describe('forecast', () => {
  it('projects recurring income and bills with a reproducible balance (spec §14)', () => {
    const main = acc({ id: 'main', accountType: 'CURRENT', openingBalance: 500_000 });
    const txns = [
      ...monthly('ACME Payroll', 390_000, '25', [2025, 8], 'INCOME'),
      ...monthly('Property Mgmt', -145_000, '01', [2025, 9], 'EXPENSE', 'rent'),
    ];
    const f = forecast(snap({ asOf: '2026-08-05', accounts: [main], transactions: txns }), 30);

    const salary = f.items.find((i) => i.source === 'RECURRING' && i.amount === 390_000);
    const rent = f.items.find((i) => i.source === 'RECURRING' && i.amount === -145_000);
    expect(salary).toBeTruthy();
    expect(rent).toBeTruthy();
    // opening + salary - rent, predicted spend fully explained by the recurring bill -> 0
    expect(f.projectedBalance - f.openingBalance).toBe(245_000);
    expect(f.low).toBe(f.projectedBalance); // no predicted uncertainty
    expect(f.high).toBe(f.projectedBalance);
  });

  it('adds predicted discretionary spend with a widening confidence band', () => {
    const main = acc({ id: 'main', accountType: 'CURRENT', openingBalance: 500_000 });
    // Distinct merchant words each month => not recurring => stays as behavioural/predicted spend.
    const names = ['Amazon', 'Zara', 'Uniqlo', 'Boots', 'Greggs', 'Costa', 'Ikea', 'Halfords', 'Wilko', 'Ryman', 'Hobbycraft', 'Superdrug'];
    const shopping = names.map((name, i) => {
      const y = 2025 + Math.floor((7 + i) / 12);
      const m = ((7 + i) % 12) + 1;
      return txn({ accountId: 'main', merchant: name, amount: -25_000, date: `${y}-${String(m).padStart(2, '0')}-10`, transactionType: 'EXPENSE', categoryId: 'shopping' });
    });
    const f = forecast(snap({ asOf: '2026-08-05', accounts: [main], transactions: shopping }), 30);

    expect(f.items.some((i) => i.source === 'PREDICTED' && i.amount < 0)).toBe(true);
    expect(f.projectedBalance).toBeLessThan(f.openingBalance); // money spent
    expect(f.low).toBeLessThan(f.projectedBalance);
    expect(f.high).toBeGreaterThan(f.projectedBalance);
  });

  it('produces all four horizons', () => {
    const main = acc({ id: 'main', accountType: 'CURRENT', openingBalance: 500_000 });
    const h = forecastHorizons(snap({ asOf: '2026-08-05', accounts: [main], transactions: monthly('ACME Payroll', 390_000, '25', [2025, 8], 'INCOME') }));
    expect(Object.keys(h).map(Number).sort((a, b) => a - b)).toEqual([7, 30, 90, 365]);
    expect(h[365].items.filter((i) => i.amount === 390_000).length).toBeGreaterThanOrEqual(11);
  });
});

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

  it('widens the confidence band for a variable recurring bill', () => {
    const main = acc({ id: 'main', accountType: 'CURRENT', openingBalance: 500_000 });
    // A monthly utility whose amount swings month to month => a VARIABLE recurring series that adds
    // uncertainty to the band, even though the bill is otherwise fully explained (little predicted).
    const amts = [-11000, -16000, -13000, -17000, -12000, -15000, -14000, -16500, -11500, -15500, -13500, -16000];
    const bills = [];
    let y = 2025, m = 8;
    for (let i = 0; i < 12; i++) {
      bills.push(txn({ accountId: 'main', merchant: 'Octopus Energy', amount: amts[i], date: `${y}-${String(m).padStart(2, '0')}-06`, transactionType: 'EXPENSE', categoryId: 'utilities' }));
      if (++m > 12) { m = 1; y++; }
    }
    const f = forecast(snap({ asOf: '2026-08-05', accounts: [main], transactions: bills }), 30);
    expect(f.high).toBeGreaterThan(f.projectedBalance); // non-zero band from recurring variance
    expect(f.low).toBeLessThan(f.projectedBalance);
  });

  it('surfaces a pending future-dated transaction as a planned (USER_ENTERED) item', () => {
    const main = acc({ id: 'main', accountType: 'CURRENT', openingBalance: 500_000 });
    // Manual + pending + future-dated => a user-entered plan.
    const planned = txn({ accountId: 'main', merchant: 'Car service', amount: -80_000, date: '2026-08-15', status: 'PENDING', source: 'MANUAL' });
    const f = forecast(snap({ asOf: '2026-08-05', accounts: [main], transactions: [planned] }), 30);
    const item = f.items.find((i) => i.source === 'USER_ENTERED');
    expect(item?.amount).toBe(-80_000);
    expect(f.openingBalance).toBe(500_000); // pending excluded from settled balance
    expect(f.projectedBalance).toBe(420_000); // ...but it lowers the projection
  });

  it('schedules a loan payment as a KNOWN item on its due day (metadata-only account)', () => {
    const main = acc({ id: 'main', accountType: 'CURRENT', openingBalance: 500_000 });
    // A loan with a known monthly payment but no transaction history yet (freshly onboarded).
    const loan = acc({ id: 'loan', accountType: 'LOAN', openingBalance: -1_200_000, minimumPayment: 45_000, paymentDueDay: 12 });
    const f = forecast(snap({ asOf: '2026-08-05', accounts: [main, loan], transactions: [] }), 30);
    const item = f.items.find((i) => i.source === 'KNOWN' && i.label === 'loan payment');
    expect(item?.date).toBe('2026-08-12');
    expect(item?.amount).toBe(-45_000);
    expect(f.projectedBalance).toBe(455_000); // opening 500k less the 45k payment
  });

  it('does NOT double-count a loan payment once the account has transaction history', () => {
    const main = acc({ id: 'main', accountType: 'CURRENT', openingBalance: 500_000 });
    const loan = acc({ id: 'loan', accountType: 'LOAN', openingBalance: -1_200_000, minimumPayment: 45_000, paymentDueDay: 12 });
    // Any real transaction on the loan means recurring detection owns the payment now.
    const hist = txn({ accountId: 'loan', amount: 45_000, date: '2026-07-12', transactionType: 'TRANSFER' });
    const f = forecast(snap({ asOf: '2026-08-05', accounts: [main, loan], transactions: [hist] }), 30);
    expect(f.items.some((i) => i.label === 'loan payment')).toBe(false);
  });

  it('produces all four horizons', () => {
    const main = acc({ id: 'main', accountType: 'CURRENT', openingBalance: 500_000 });
    const h = forecastHorizons(snap({ asOf: '2026-08-05', accounts: [main], transactions: monthly('ACME Payroll', 390_000, '25', [2025, 8], 'INCOME') }));
    expect(Object.keys(h).map(Number).sort((a, b) => a - b)).toEqual([7, 30, 90, 365]);
    expect(h[365].items.filter((i) => i.amount === 390_000).length).toBeGreaterThanOrEqual(11);
  });
});

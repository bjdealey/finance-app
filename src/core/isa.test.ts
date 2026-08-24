import { describe, it, expect } from 'vitest';
import { isaAllowance, taxYearStart, ISA_ANNUAL_ALLOWANCE_PENCE } from './isa';
import { acc, txn, snap } from './testkit';

describe('taxYearStart', () => {
  it('anchors on 6 April', () => {
    expect(taxYearStart('2026-08-24')).toBe('2026-04-06'); // after 6 Apr -> this year
    expect(taxYearStart('2026-04-06')).toBe('2026-04-06'); // on the boundary -> this year
    expect(taxYearStart('2026-04-05')).toBe('2025-04-06'); // day before -> previous year
    expect(taxYearStart('2026-01-10')).toBe('2025-04-06'); // Jan -> previous April
  });
});

describe('isaAllowance', () => {
  it('sums contributions into ISA-wrapped accounts within the tax year, ignoring interest', () => {
    const cashIsa = acc({ id: 'cisa', accountType: 'CASH_ISA', taxWrapper: 'CASH_ISA' });
    const ssIsa = acc({ id: 'sisa', accountType: 'INVESTMENT', taxWrapper: 'STOCKS_SHARES_ISA' });
    const nonIsa = acc({ id: 'easy', accountType: 'SAVINGS', taxWrapper: null });
    const txns = [
      txn({ accountId: 'cisa', amount: 300_00, date: '2026-05-27', transactionType: 'TRANSFER' }), // counts
      txn({ accountId: 'sisa', amount: 250_00, date: '2026-06-27', transactionType: 'TRANSFER' }), // counts (combined allowance)
      txn({ accountId: 'cisa', amount: 12_00, date: '2026-06-30', transactionType: 'INTEREST' }), // interest: ignored
      txn({ accountId: 'cisa', amount: 500_00, date: '2026-03-30', transactionType: 'TRANSFER' }), // last tax year: ignored
      txn({ accountId: 'easy', amount: 900_00, date: '2026-05-10', transactionType: 'TRANSFER' }), // non-ISA: ignored
    ];
    const isa = isaAllowance(snap({ asOf: '2026-08-24', accounts: [cashIsa, ssIsa, nonIsa], transactions: txns }));
    expect(isa.taxYearStart).toBe('2026-04-06');
    expect(isa.used).toBe(550_00);
    expect(isa.remaining).toBe(ISA_ANNUAL_ALLOWANCE_PENCE - 550_00);
  });

  it('never reports negative remaining when over-subscribed', () => {
    const cashIsa = acc({ id: 'cisa', accountType: 'CASH_ISA', taxWrapper: 'CASH_ISA' });
    const isa = isaAllowance(snap({ asOf: '2026-08-24', accounts: [cashIsa], transactions: [txn({ accountId: 'cisa', amount: 25_000_00, date: '2026-05-01', transactionType: 'TRANSFER' })] }));
    expect(isa.used).toBe(25_000_00);
    expect(isa.remaining).toBe(0);
  });
});

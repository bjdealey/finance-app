import { describe, it, expect } from 'vitest';
import { computeBalances, isInternalTransfer } from './ledger';
import { acc, txn, snap } from './testkit';

describe('ledger.computeBalances', () => {
  it('sums income, expenses and fees onto the opening balance', () => {
    const a = acc({ id: 'a', openingBalance: 100_000 }); // £1,000
    const s = snap({
      accounts: [a],
      transactions: [
        txn({ accountId: 'a', amount: 50_000, transactionType: 'INCOME' }),
        txn({ accountId: 'a', amount: -20_000, transactionType: 'EXPENSE' }),
        txn({ accountId: 'a', amount: -500, transactionType: 'FEE' }),
      ],
    });
    expect(computeBalances(s)[0].balance).toBe(129_500);
  });

  it('does not lose money across an internal transfer', () => {
    const s = snap({
      accounts: [acc({ id: 'cur', openingBalance: 100_000 }), acc({ id: 'sav', openingBalance: 0 })],
      transactions: [
        txn({ accountId: 'cur', amount: -30_000, transactionType: 'TRANSFER', transferGroupId: 'g1' }),
        txn({ accountId: 'sav', amount: 30_000, transactionType: 'TRANSFER', transferGroupId: 'g1' }),
      ],
    });
    const b = computeBalances(s);
    expect(b.find((x) => x.accountId === 'cur')!.balance).toBe(70_000);
    expect(b.find((x) => x.accountId === 'sav')!.balance).toBe(30_000);
    expect(b[0].balance + b[1].balance).toBe(100_000); // conserved
  });

  it('applies refunds and ignores reversed transactions', () => {
    const s = snap({
      accounts: [acc({ id: 'a', openingBalance: 0 })],
      transactions: [
        txn({ accountId: 'a', amount: -10_000, transactionType: 'EXPENSE' }),
        txn({ accountId: 'a', amount: 4_500, transactionType: 'REFUND' }),
        txn({ accountId: 'a', amount: -99_900, status: 'REVERSED' }), // must not count
      ],
    });
    expect(computeBalances(s)[0].balance).toBe(-5_500);
  });

  it('separates pending from settled in available balance', () => {
    const s = snap({
      accounts: [acc({ id: 'a', openingBalance: 20_000 })],
      transactions: [txn({ accountId: 'a', amount: -5_000, status: 'PENDING' })],
    });
    const b = computeBalances(s)[0];
    expect(b.balance).toBe(20_000); // settled unaffected
    expect(b.available).toBe(15_000); // pending debit reduces available
  });

  it('reports remaining credit as available for a credit card', () => {
    const s = snap({
      accounts: [acc({ id: 'cc', accountType: 'CREDIT_CARD', creditLimit: 500_000, openingBalance: -60_000 })],
      transactions: [txn({ accountId: 'cc', amount: -5_000, transactionType: 'EXPENSE' })],
    });
    const b = computeBalances(s)[0];
    expect(b.balance).toBe(-65_000); // owed
    expect(b.available).toBe(435_000); // limit - owed
  });

  it('classifies internal transfers and card payments', () => {
    expect(isInternalTransfer(txn({ transactionType: 'TRANSFER' }))).toBe(true);
    expect(isInternalTransfer(txn({ transactionType: 'CARD_PAYMENT' }))).toBe(true);
    expect(isInternalTransfer(txn({ transferGroupId: 'g1' }))).toBe(true);
    expect(isInternalTransfer(txn({ transactionType: 'EXPENSE' }))).toBe(false);
  });
});

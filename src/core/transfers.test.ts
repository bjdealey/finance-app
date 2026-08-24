import { describe, it, expect } from 'vitest';
import { detectTransfers } from './transfers';
import { txn } from './testkit';

describe('detectTransfers', () => {
  it('pairs a debit with the matching credit in another account', () => {
    const pairs = detectTransfers([
      txn({ id: 'out', accountId: 'cur', amount: -50_000, date: '2025-06-10' }),
      txn({ id: 'in', accountId: 'sav', amount: 50_000, date: '2025-06-11' }),
    ]);
    expect(pairs).toEqual([['out', 'in']]);
  });

  it('does not pair within the same account', () => {
    const pairs = detectTransfers([
      txn({ id: 'a', accountId: 'cur', amount: -50_000, date: '2025-06-10' }),
      txn({ id: 'b', accountId: 'cur', amount: 50_000, date: '2025-06-10' }),
    ]);
    expect(pairs).toEqual([]);
  });

  it('ignores transactions already in a transfer group', () => {
    const pairs = detectTransfers([
      txn({ id: 'out', accountId: 'cur', amount: -50_000, date: '2025-06-10', transferGroupId: 'g' }),
      txn({ id: 'in', accountId: 'sav', amount: 50_000, date: '2025-06-10', transferGroupId: 'g' }),
    ]);
    expect(pairs).toEqual([]);
  });

  it('respects the day window', () => {
    const pairs = detectTransfers(
      [
        txn({ id: 'out', accountId: 'cur', amount: -50_000, date: '2025-06-01' }),
        txn({ id: 'in', accountId: 'sav', amount: 50_000, date: '2025-06-20' }),
      ],
      { maxDays: 3 },
    );
    expect(pairs).toEqual([]);
  });

  it('does not reuse a credit for two debits', () => {
    const pairs = detectTransfers([
      txn({ id: 'out1', accountId: 'cur', amount: -50_000, date: '2025-06-10' }),
      txn({ id: 'out2', accountId: 'cur', amount: -50_000, date: '2025-06-10' }),
      txn({ id: 'in', accountId: 'sav', amount: 50_000, date: '2025-06-10' }),
    ]);
    expect(pairs).toHaveLength(1);
  });
});

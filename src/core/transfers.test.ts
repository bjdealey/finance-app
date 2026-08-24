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

  it('takes the nearest-date credit, not just the first in input order', () => {
    // Both credits are equal-and-opposite and within the window; 'far' appears first in the array,
    // so a first-match-wins detector would wrongly grab it over the same-day 'near'.
    const pairs = detectTransfers([
      txn({ id: 'far', accountId: 'sav', amount: 50_000, date: '2025-06-13' }), // 3 days off
      txn({ id: 'out', accountId: 'cur', amount: -50_000, date: '2025-06-10' }),
      txn({ id: 'near', accountId: 'sav', amount: 50_000, date: '2025-06-10' }), // same day
    ]);
    expect(pairs).toEqual([['out', 'near']]);
  });

  it('pairs identically no matter the input/row order (deterministic — spec §38)', () => {
    const rows = [
      txn({ id: 'd1', accountId: 'cur', amount: -20_000, date: '2025-06-10' }),
      txn({ id: 'c1', accountId: 'sav', amount: 20_000, date: '2025-06-10' }),
      txn({ id: 'd2', accountId: 'cur', amount: -20_000, date: '2025-06-12' }),
      txn({ id: 'c2', accountId: 'sav', amount: 20_000, date: '2025-06-12' }),
    ];
    const forward = detectTransfers(rows);
    const reversed = detectTransfers([...rows].reverse());
    expect(reversed).toEqual(forward);
    // Same-amount legs pair by date, never cross-paired (d1->c1, d2->c2), regardless of order.
    expect(new Set(forward.map((p) => p.join('->')))).toEqual(new Set(['d1->c1', 'd2->c2']));
  });
});

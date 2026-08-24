import type { FinancialSnapshot, Transaction } from './types';

export interface AccountBalance {
  accountId: string;
  balance: number; // pence; settled (POSTED). Credit cards are negative when money is owed.
  available: number; // pence; current/savings: balance + pending. Credit card: remaining credit.
}

// A transaction moves money between the user's own accounts (not spending, not income).
export function isInternalTransfer(t: Transaction): boolean {
  return t.transferGroupId != null || t.transactionType === 'TRANSFER' || t.transactionType === 'CARD_PAYMENT';
}

// Derived balances from the immutable ledger. Never stored — always reproducible from opening + txns.
export function computeBalances(snapshot: FinancialSnapshot): AccountBalance[] {
  const posted = new Map<string, number>();
  const pending = new Map<string, number>();
  for (const t of snapshot.transactions) {
    if (t.status === 'REVERSED') continue; // reversed entries never affect balance
    const bucket = t.status === 'PENDING' ? pending : posted;
    bucket.set(t.accountId, (bucket.get(t.accountId) ?? 0) + t.amount);
  }
  return snapshot.accounts.map((a) => {
    const balance = a.openingBalance + (posted.get(a.id) ?? 0);
    let available: number;
    if (a.accountType === 'CREDIT_CARD' && a.creditLimit != null) {
      available = a.creditLimit + balance; // balance negative (owed) => remaining credit
    } else {
      available = balance + (pending.get(a.id) ?? 0);
    }
    return { accountId: a.id, balance, available };
  });
}

export function balanceMap(snapshot: FinancialSnapshot): Map<string, AccountBalance> {
  return new Map(computeBalances(snapshot).map((b) => [b.accountId, b]));
}

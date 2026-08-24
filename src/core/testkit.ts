import type { Account, Transaction, FinancialSnapshot, Category, Goal, UserRule } from './types';

// Fixture builders for engine unit tests. Not a test file (won't be collected by vitest).
let seq = 0;

export function acc(p: Partial<Account> = {}): Account {
  const id = p.id ?? `acc-${++seq}`;
  return {
    id,
    name: p.name ?? id,
    institution: p.institution ?? null,
    accountType: p.accountType ?? 'CURRENT',
    currency: p.currency ?? 'GBP',
    openingBalance: p.openingBalance ?? 0,
    openingBalanceDate: p.openingBalanceDate ?? '2025-01-01',
    interestRateBps: p.interestRateBps ?? 0,
    accessType: p.accessType ?? 'INSTANT',
    taxWrapper: p.taxWrapper ?? null,
    purpose: p.purpose ?? null,
    creditLimit: p.creditLimit ?? null,
    minimumPayment: p.minimumPayment ?? null,
    paymentDueDay: p.paymentDueDay ?? null,
    statementDay: p.statementDay ?? null,
    active: p.active ?? true,
  };
}

export function txn(p: Partial<Transaction> = {}): Transaction {
  const id = p.id ?? `txn-${++seq}`;
  return {
    id,
    accountId: p.accountId ?? 'acc-1',
    date: p.date ?? '2025-06-15',
    amount: p.amount ?? 0,
    currency: p.currency ?? 'GBP',
    merchant: p.merchant ?? null,
    description: p.description ?? null,
    categoryId: p.categoryId ?? null,
    transactionType: p.transactionType ?? 'UNKNOWN',
    status: p.status ?? 'POSTED',
    transferGroupId: p.transferGroupId ?? null,
  };
}

export function snap(p: Partial<FinancialSnapshot> = {}): FinancialSnapshot {
  return {
    asOf: p.asOf ?? '2025-07-01',
    accounts: p.accounts ?? [],
    transactions: p.transactions ?? [],
    categories: p.categories ?? [],
    goals: p.goals ?? [],
    userRules: p.userRules ?? [],
  };
}

export function cat(p: Partial<Category> = {}): Category {
  const id = p.id ?? `cat-${++seq}`;
  return { id, name: p.name ?? id, parentId: p.parentId ?? null, kind: p.kind ?? 'EXPENSE' };
}

export function goal(p: Partial<Goal> = {}): Goal {
  const id = p.id ?? `goal-${++seq}`;
  return {
    id,
    name: p.name ?? id,
    targetAmount: p.targetAmount ?? 0,
    targetDate: p.targetDate ?? null,
    linkedAccountId: p.linkedAccountId ?? null,
    currentAmount: p.currentAmount ?? 0,
    priority: p.priority ?? 100,
  };
}

export function rule(p: Partial<UserRule> = {}): UserRule {
  const id = p.id ?? `rule-${++seq}`;
  return { id, ruleType: p.ruleType ?? 'MIN_CURRENT_BALANCE', params: p.params ?? {}, active: p.active ?? true };
}

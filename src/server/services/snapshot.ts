import { eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import * as s from '@/server/db/schema';
import type { Account, Transaction, FinancialSnapshot } from '@/core/types';

function mapAccount(r: s.AccountRow): Account {
  return {
    id: r.id,
    name: r.name,
    institution: r.institution,
    accountType: r.accountType,
    currency: r.currency,
    openingBalance: r.openingBalance,
    openingBalanceDate: r.openingBalanceDate,
    interestRateBps: r.interestRateBps,
    accessType: r.accessType,
    taxWrapper: (r.taxWrapper as Account['taxWrapper']) ?? null,
    purpose: r.purpose,
    creditLimit: r.creditLimit,
    minimumPayment: r.minimumPayment,
    paymentDueDay: r.paymentDueDay,
    statementDay: r.statementDay,
    active: r.active,
  };
}

function mapTxn(r: s.TransactionRow): Transaction {
  return {
    id: r.id,
    accountId: r.accountId,
    date: r.date,
    amount: r.amount,
    currency: r.currency,
    merchant: r.merchant,
    description: r.description,
    categoryId: r.categoryId,
    transactionType: r.transactionType,
    status: r.status,
    transferGroupId: r.transferGroupId,
  };
}

// Loads everything the engines need for one user, mapped to DB-free core types.
// Every query is scoped by userId (from the session, never client input).
export async function loadSnapshot(userId: string, asOf?: string): Promise<FinancialSnapshot> {
  const [accounts, transactions, categories, goals, userRules] = await Promise.all([
    db.select().from(s.accounts).where(eq(s.accounts.userId, userId)),
    db.select().from(s.transactions).where(eq(s.transactions.userId, userId)),
    db.select().from(s.categories).where(eq(s.categories.userId, userId)),
    db.select().from(s.goals).where(eq(s.goals.userId, userId)),
    db.select().from(s.userRules).where(eq(s.userRules.userId, userId)),
  ]);
  return {
    asOf: asOf ?? new Date().toISOString().slice(0, 10),
    accounts: accounts.map(mapAccount),
    transactions: transactions.map(mapTxn),
    categories: categories.map((c) => ({ id: c.id, name: c.name, parentId: c.parentId, kind: c.kind })),
    goals: goals.map((g) => ({
      id: g.id,
      name: g.name,
      targetAmount: g.targetAmount,
      targetDate: g.targetDate,
      linkedAccountId: g.linkedAccountId,
      currentAmount: g.currentAmount,
      priority: g.priority,
    })),
    userRules: userRules.map((r) => ({ id: r.id, ruleType: r.ruleType, params: r.params, active: r.active })),
  };
}

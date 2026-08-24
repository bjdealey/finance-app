import { and, eq, gte, lte, ilike, or, desc, sql, type SQL } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { transactions, accounts, categories, categoryRules } from '@/server/db/schema';
import type { TransactionType, TxnStatus } from '@/core/types';

export interface TxnFilters {
  search?: string;
  accountId?: string;
  categoryId?: string;
  type?: TransactionType;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export interface TxnListRow {
  id: string;
  date: string;
  amount: number;
  merchant: string | null;
  description: string | null;
  accountId: string;
  accountName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  transactionType: TransactionType;
  transferGroupId: string | null;
  source: string;
  status: string;
}

function buildWhere(userId: string, f: TxnFilters): SQL {
  const conds: SQL[] = [eq(transactions.userId, userId)];
  if (f.accountId) conds.push(eq(transactions.accountId, f.accountId));
  if (f.categoryId) conds.push(eq(transactions.categoryId, f.categoryId));
  if (f.type) conds.push(eq(transactions.transactionType, f.type));
  if (f.dateFrom) conds.push(gte(transactions.date, f.dateFrom));
  if (f.dateTo) conds.push(lte(transactions.date, f.dateTo));
  if (f.search) {
    const like = `%${f.search}%`;
    conds.push(or(ilike(transactions.merchant, like), ilike(transactions.description, like)) as SQL);
  }
  return and(...conds) as SQL;
}

export async function listTransactions(
  userId: string,
  f: TxnFilters = {},
): Promise<{ rows: TxnListRow[]; total: number }> {
  const where = buildWhere(userId, f);
  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: transactions.id,
        date: transactions.date,
        amount: transactions.amount,
        merchant: transactions.merchant,
        description: transactions.description,
        accountId: transactions.accountId,
        accountName: accounts.name,
        categoryId: transactions.categoryId,
        categoryName: categories.name,
        transactionType: transactions.transactionType,
        transferGroupId: transactions.transferGroupId,
        source: transactions.source,
        status: transactions.status,
      })
      .from(transactions)
      .leftJoin(accounts, eq(transactions.accountId, accounts.id))
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(where)
      .orderBy(desc(transactions.date), desc(transactions.createdAt))
      .limit(f.limit ?? 50)
      .offset(f.offset ?? 0),
    db.select({ n: sql<number>`count(*)::int` }).from(transactions).where(where),
  ]);
  return { rows: rows as TxnListRow[], total: countRows[0]?.n ?? 0 };
}

// Correct a transaction's category and LEARN it: store a high-priority merchant rule so future
// imports categorise the same merchant automatically (spec §27). Strictly user-scoped.
export async function correctCategory(userId: string, txnId: string, categoryId: string): Promise<void> {
  const [row] = await db
    .update(transactions)
    .set({ categoryId, confidence: 100 })
    .where(and(eq(transactions.id, txnId), eq(transactions.userId, userId)))
    .returning({ merchant: transactions.merchant });
  if (!row) return; // not found or not owned — no-op (IDOR-safe)

  const merchant = row.merchant?.trim();
  if (merchant) {
    await db
      .insert(categoryRules)
      .values({ userId, matchType: 'MERCHANT_EXACT', pattern: merchant, categoryId, priority: 0, source: 'USER_CORRECTION' });
  }
}

// ---- Manual entry -----------------------------------------------------------

export interface NewTransaction {
  accountId: string;
  date: string; // YYYY-MM-DD
  amount: number; // signed pence (negative = money out)
  description: string | null;
  merchant: string | null;
  categoryId: string | null;
  transactionType: TransactionType;
  status: TxnStatus; // POSTED for settled; PENDING for a future-dated plan
}

// Add a user-entered transaction. The destination account is verified to belong to the user first
// (IDOR-safe). Stored as source=MANUAL so it can later be deleted (imported/seed rows cannot).
export async function addTransaction(userId: string, input: NewTransaction): Promise<void> {
  const [owned] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.id, input.accountId), eq(accounts.userId, userId)))
    .limit(1);
  if (!owned) throw new Error('Account not found');
  await db.insert(transactions).values({
    userId,
    accountId: input.accountId,
    date: input.date,
    amount: input.amount,
    merchant: input.merchant,
    description: input.description,
    categoryId: input.categoryId,
    transactionType: input.transactionType,
    status: input.status,
    source: 'MANUAL',
    confidence: input.categoryId ? 100 : 0,
  });
}

// Delete a MANUAL transaction only — imported/seed ledger entries stay immutable (spec §37).
export async function deleteTransaction(userId: string, id: string): Promise<void> {
  await db
    .delete(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId), eq(transactions.source, 'MANUAL')));
}

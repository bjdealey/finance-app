import { randomUUID } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { transactions, categoryRules, importBatches, accounts } from '@/server/db/schema';
import { categorise, type CatRule } from '@/core/categorise';
import { detectTransfers } from '@/core/transfers';
import { planDedupe, type ParsedRow } from '@/core/import';
import type { Transaction } from '@/core/types';

export interface ImportResult {
  imported: number;
  duplicates: number; // rows skipped as re-imports (already in the ledger)
  possibleDuplicates: number; // identical rows within the file — imported, flagged for review
  batchId: string;
  transfersDetected: number;
}

// Ingest validated rows into one account: dedupe against existing rows, categorise via the user's
// rules, insert under an import batch, then re-run transfer detection across the account set.
export async function importTransactions(
  userId: string,
  accountId: string,
  rows: ParsedRow[],
  filename: string,
): Promise<ImportResult> {
  // Authorisation: the account must belong to this user (IDOR-safe).
  const owned = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
    .limit(1);
  if (!owned.length) throw new Error('Account not found');

  const existingKeys = new Set(
    (await db.select({ k: transactions.dedupeKey }).from(transactions).where(eq(transactions.accountId, accountId)))
      .map((r) => r.k)
      .filter((k): k is string => k != null),
  );
  const rules: CatRule[] = (await db.select().from(categoryRules).where(eq(categoryRules.userId, userId))).map((r) => ({
    matchType: r.matchType,
    pattern: r.pattern,
    categoryId: r.categoryId,
    priority: r.priority,
  }));

  const [batch] = await db.insert(importBatches).values({ userId, filename, rowCount: rows.length }).returning();

  // Skip rows already in the ledger (re-import); KEEP identical rows within this file, flagged —
  // two identical purchases on the same day are legitimate and dropping them understates spending.
  const plan = planDedupe(accountId, rows, existingKeys);
  const toInsert: (typeof transactions.$inferInsert)[] = plan.toInsert.map(({ row: r, key }) => {
    const { categoryId, confidence } = categorise({ merchant: r.description, description: r.description }, rules);
    return {
      userId,
      accountId,
      date: r.date,
      amount: r.amount,
      currency: 'GBP',
      merchant: r.description,
      description: r.description,
      categoryId,
      transactionType: r.amount < 0 ? 'EXPENSE' : r.amount > 0 ? 'INCOME' : 'UNKNOWN',
      status: 'POSTED',
      confidence,
      source: 'CSV',
      importBatchId: batch.id,
      dedupeKey: key,
    };
  });
  for (let i = 0; i < toInsert.length; i += 200) await db.insert(transactions).values(toInsert.slice(i, i + 200));
  await db
    .update(importBatches)
    .set({ importedCount: toInsert.length, duplicateCount: plan.skipped })
    .where(eq(importBatches.id, batch.id));

  const transfersDetected = await runTransferDetection(userId);
  return { imported: toInsert.length, duplicates: plan.skipped, possibleDuplicates: plan.possibleDuplicates, batchId: batch.id, transfersDetected };
}

// Pair newly-untagged debits/credits across the user's accounts and tag both legs as transfers.
export async function runTransferDetection(userId: string): Promise<number> {
  const rows = await db
    .select({
      id: transactions.id,
      accountId: transactions.accountId,
      amount: transactions.amount,
      date: transactions.date,
      status: transactions.status,
      transferGroupId: transactions.transferGroupId,
    })
    .from(transactions)
    .where(eq(transactions.userId, userId));
  const pairs = detectTransfers(rows as unknown as Transaction[]);
  for (const [a, b] of pairs) {
    const gid = randomUUID();
    await db
      .update(transactions)
      .set({ transferGroupId: gid, transactionType: 'TRANSFER' })
      .where(and(eq(transactions.userId, userId), inArray(transactions.id, [a, b])));
  }
  return pairs.length;
}

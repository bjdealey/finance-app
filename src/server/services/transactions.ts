import { and, eq, gte, lte, ilike, or, desc, sql, inArray, notInArray, type SQL } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { transactions, accounts, categories, categoryRules } from '@/server/db/schema';
import { merchantToken } from '@/core/categorise';
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

// Fetch a MANUAL transaction's re-addable fields, for delete → undo. Null if not found, not owned,
// or not MANUAL (only MANUAL rows can be deleted, so only those need a restore path).
export async function getTransaction(userId: string, id: string): Promise<NewTransaction | null> {
  const [row] = await db
    .select({
      accountId: transactions.accountId,
      date: transactions.date,
      amount: transactions.amount,
      description: transactions.description,
      merchant: transactions.merchant,
      categoryId: transactions.categoryId,
      transactionType: transactions.transactionType,
      status: transactions.status,
    })
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId), eq(transactions.source, 'MANUAL')))
    .limit(1);
  return row ? (row as NewTransaction) : null;
}

// Delete a MANUAL transaction only — imported/seed ledger entries stay immutable (spec §37).
export async function deleteTransaction(userId: string, id: string): Promise<void> {
  await db
    .delete(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId), eq(transactions.source, 'MANUAL')));
}

// ---- Bulk operations (multi-select) ----------------------------------------

// A selection is either an explicit set of row ids (the current page's checkboxes) or the full set
// matching the active filter ("select all N matching"). Every bulk op resolves it to one WHERE clause.
export type Selection =
  | { mode: 'ids'; ids: string[] }
  | { mode: 'filter'; filter: TxnFilters };

function selectionWhere(userId: string, sel: Selection): SQL {
  if (sel.mode === 'ids') {
    return and(eq(transactions.userId, userId), inArray(transactions.id, sel.ids)) as SQL;
  }
  return buildWhere(userId, sel.filter); // buildWhere ignores limit/offset — bulk acts on the whole match
}

// Transfers and card-payments are internal movements that carry no category — excluded from
// recategorisation and reported as skipped, never silently changed.
const NON_CATEGORISABLE: TransactionType[] = ['TRANSFER', 'CARD_PAYMENT'];

export async function categoryOwned(userId: string, categoryId: string): Promise<boolean> {
  const [c] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)))
    .limit(1);
  return Boolean(c);
}

// Recategorise every categorisable row in the selection in one statement. Returns how many were set
// and how many were skipped as non-categorisable, for an honest "N recategorised · M skipped" message.
export async function bulkRecategorize(
  userId: string,
  sel: Selection,
  categoryId: string,
): Promise<{ updated: number; skipped: number }> {
  const base = selectionWhere(userId, sel);
  const updated = await db
    .update(transactions)
    .set({ categoryId, confidence: 100 })
    .where(and(base, notInArray(transactions.transactionType, NON_CATEGORISABLE)) as SQL)
    .returning({ id: transactions.id });
  const [skip] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(transactions)
    .where(and(base, inArray(transactions.transactionType, NON_CATEGORISABLE)) as SQL);
  return { updated: updated.length, skipped: skip?.n ?? 0 };
}

// Delete only the MANUAL rows in the selection (imported/seed entries stay immutable), capturing their
// re-addable fields first so the whole batch restores from one Undo. Non-manual rows are counted as
// skipped, never touched.
export async function bulkDeleteManual(
  userId: string,
  sel: Selection,
): Promise<{ deleted: NewTransaction[]; skipped: number }> {
  const base = selectionWhere(userId, sel);
  const manual = and(base, eq(transactions.source, 'MANUAL')) as SQL;
  const captured = await db
    .select({
      accountId: transactions.accountId,
      date: transactions.date,
      amount: transactions.amount,
      description: transactions.description,
      merchant: transactions.merchant,
      categoryId: transactions.categoryId,
      transactionType: transactions.transactionType,
      status: transactions.status,
    })
    .from(transactions)
    .where(manual);
  const [skip] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(transactions)
    .where(and(base, notInArray(transactions.source, ['MANUAL'])) as SQL);
  if (captured.length) await db.delete(transactions).where(manual);
  return { deleted: captured as NewTransaction[], skipped: skip?.n ?? 0 };
}

// Create auto-categorise rules from the selection's merchants (one KEYWORD rule per distinct token,
// skipping tokens that already have a rule for this category), then file the selection into that
// category too. Future imports of those merchants then categorise themselves.
export async function bulkCreateRuleAndFile(
  userId: string,
  sel: Selection,
  categoryId: string,
): Promise<{ rulesCreated: number; tokens: string[]; filed: number }> {
  const base = selectionWhere(userId, sel);
  const rows = await db.select({ merchant: transactions.merchant }).from(transactions).where(base);
  const tokens = [...new Set(rows.map((r) => merchantToken(r.merchant)).filter((t): t is string => t !== null))];

  let created: string[] = [];
  if (tokens.length) {
    const existing = await db
      .select({ pattern: categoryRules.pattern })
      .from(categoryRules)
      .where(and(eq(categoryRules.userId, userId), eq(categoryRules.matchType, 'KEYWORD'), eq(categoryRules.categoryId, categoryId)));
    const have = new Set(existing.map((e) => e.pattern.toLowerCase()));
    created = tokens.filter((t) => !have.has(t));
    if (created.length) {
      await db.insert(categoryRules).values(
        created.map((pattern) => ({ userId, matchType: 'KEYWORD' as const, pattern, categoryId, priority: 0, source: 'USER_CORRECTION' as const })),
      );
    }
  }

  const { updated } = await bulkRecategorize(userId, sel, categoryId);
  return { rulesCreated: created.length, tokens: created, filed: updated };
}

// Serialise the selection to CSV for download (newest first, capped). Columns match the on-screen list.
const EXPORT_CAP = 10_000;
function csvCell(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
export async function exportTransactionsCsv(
  userId: string,
  sel: Selection,
): Promise<{ csv: string; rowCount: number; capped: boolean }> {
  const rows = await db
    .select({
      date: transactions.date,
      merchant: transactions.merchant,
      description: transactions.description,
      accountName: accounts.name,
      categoryName: categories.name,
      amount: transactions.amount,
      transactionType: transactions.transactionType,
      status: transactions.status,
    })
    .from(transactions)
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(selectionWhere(userId, sel))
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .limit(EXPORT_CAP + 1);

  const capped = rows.length > EXPORT_CAP;
  const use = capped ? rows.slice(0, EXPORT_CAP) : rows;
  const lines = ['Date,Merchant,Account,Category,Amount,Type,Status'];
  for (const r of use) {
    lines.push(
      [
        r.date,
        r.merchant ?? r.description ?? '',
        r.accountName ?? '',
        r.categoryName ?? '',
        (r.amount / 100).toFixed(2),
        r.transactionType.toLowerCase(),
        r.status.toLowerCase(),
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return { csv: lines.join('\r\n'), rowCount: use.length, capped };
}

'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser } from '@/server/auth/session';
import {
  correctCategory,
  addTransaction,
  deleteTransaction,
  getTransaction,
  bulkRecategorize,
  bulkDeleteManual,
  bulkCreateRuleAndFile,
  exportTransactionsCsv,
  categoryOwned,
  type NewTransaction,
  type Selection,
} from '@/server/services/transactions';
import { parseMoneyToPence } from '@/core/money';
import type { TransactionType } from '@/core/types';

export async function correctCategoryAction(txnId: string, categoryId: string): Promise<void> {
  const user = await requireUser();
  await correctCategory(user.id, txnId, categoryId);
  revalidatePath('/transactions');
}

export interface TxnFormState {
  error?: string;
}

// The transaction TYPE determines the sign: these three take money out, the rest bring it in.
const OUTFLOW = new Set(['EXPENSE', 'FEE', 'CARD_PAYMENT']);

const schema = z.object({
  accountId: z.string().trim().min(1, 'Choose an account'),
  date: z.string().trim().min(1, 'Choose a date'),
  transactionType: z.enum(['EXPENSE', 'INCOME', 'REFUND', 'INTEREST', 'FEE', 'CARD_PAYMENT']),
  amount: z.string().trim(),
  description: z.string().trim().max(140).optional(),
  categoryId: z.string().trim().optional(),
});

export async function addTransactionAction(_prev: TxnFormState, formData: FormData): Promise<TxnFormState> {
  const user = await requireUser();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid details' };
  const d = parsed.data;
  const mag = parseMoneyToPence(d.amount);
  if (mag == null || mag === 0) return { error: 'Enter an amount greater than zero.' };
  const amount = OUTFLOW.has(d.transactionType) ? -Math.abs(mag) : Math.abs(mag);
  const desc = d.description || null;
  // A future-dated entry is a PLAN (pending) — it shows in the forecast as a user-entered item and
  // doesn't touch the current balance until its date arrives. Past/today entries are settled.
  const today = new Date().toISOString().slice(0, 10);
  const status = d.date > today ? 'PENDING' : 'POSTED';
  try {
    await addTransaction(user.id, {
      accountId: d.accountId,
      date: d.date,
      amount,
      description: desc,
      merchant: desc,
      categoryId: d.categoryId || null,
      transactionType: d.transactionType as TransactionType,
      status,
    });
  } catch {
    return { error: 'Could not add the transaction — please check the account.' };
  }
  revalidatePath('/transactions');
  revalidatePath('/dashboard');
  redirect('/transactions');
}

export async function deleteTransactionAction(id: string): Promise<{ message: string; undo?: NewTransaction }> {
  const user = await requireUser();
  const txn = await getTransaction(user.id, id);
  await deleteTransaction(user.id, id);
  revalidatePath('/transactions');
  revalidatePath('/dashboard');
  return { message: 'Transaction deleted', undo: txn ?? undefined };
}

// Undo a delete — re-add the captured manual transaction.
export async function restoreTransactionAction(input: NewTransaction): Promise<void> {
  const user = await requireUser();
  await addTransaction(user.id, input);
  revalidatePath('/transactions');
  revalidatePath('/dashboard');
}

// ---- Bulk actions (multi-select on the transactions list) ------------------

const TXN_TYPES = ['INCOME', 'EXPENSE', 'TRANSFER', 'REFUND', 'INTEREST', 'FEE', 'CARD_PAYMENT', 'UNKNOWN'] as const;

// The client sends either the checked row ids or the active filter ("select all N matching"). Both are
// untrusted: ids are validated as UUIDs and capped; the filter is re-parsed to just its criteria
// (paging is dropped — a bulk op spans the whole match, not one page).
const filterSchema = z.object({
  search: z.string().max(200).optional(),
  accountId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  type: z.enum(TXN_TYPES).optional(),
  dateFrom: z.string().max(20).optional(),
  dateTo: z.string().max(20).optional(),
});
const selectionSchema = z.union([
  z.object({ mode: z.literal('ids'), ids: z.array(z.string().uuid()).min(1).max(1000) }),
  z.object({ mode: z.literal('filter'), filter: filterSchema }),
]);

function toSelection(v: z.infer<typeof selectionSchema>): Selection {
  if (v.mode === 'ids') return { mode: 'ids', ids: v.ids };
  const f = v.filter;
  return {
    mode: 'filter',
    filter: {
      search: f.search,
      accountId: f.accountId,
      categoryId: f.categoryId,
      type: f.type as TransactionType | undefined,
      dateFrom: f.dateFrom,
      dateTo: f.dateTo,
    },
  };
}

function revalidateTxns() {
  revalidatePath('/transactions');
  revalidatePath('/dashboard');
}

export async function bulkRecategorizeAction(sel: unknown, categoryId: unknown): Promise<{ message: string }> {
  const user = await requireUser();
  const s = selectionSchema.safeParse(sel);
  const cat = z.string().uuid().safeParse(categoryId);
  if (!s.success || !cat.success) return { message: 'Nothing was changed.' };
  if (!(await categoryOwned(user.id, cat.data))) return { message: 'Nothing was changed.' };
  const { updated, skipped } = await bulkRecategorize(user.id, toSelection(s.data), cat.data);
  revalidateTxns();
  return { message: `Recategorised ${updated}${skipped ? ` · ${skipped} skipped (no category)` : ''}` };
}

export async function createRuleFromSelectionAction(sel: unknown, categoryId: unknown): Promise<{ message: string }> {
  const user = await requireUser();
  const s = selectionSchema.safeParse(sel);
  const cat = z.string().uuid().safeParse(categoryId);
  if (!s.success || !cat.success) return { message: 'Nothing was changed.' };
  if (!(await categoryOwned(user.id, cat.data))) return { message: 'Nothing was changed.' };
  const { rulesCreated, tokens, filed } = await bulkCreateRuleAndFile(user.id, toSelection(s.data), cat.data);
  const rulePart = rulesCreated
    ? `Created ${rulesCreated} rule${rulesCreated > 1 ? 's' : ''} (${tokens.slice(0, 3).join(', ')}${tokens.length > 3 ? '…' : ''})`
    : 'No new rules — already covered';
  revalidateTxns();
  return { message: `${rulePart} · filed ${filed}` };
}

export async function bulkDeleteAction(sel: unknown): Promise<{ message: string; undo?: NewTransaction[] }> {
  const user = await requireUser();
  const s = selectionSchema.safeParse(sel);
  if (!s.success) return { message: 'Nothing was deleted.' };
  const { deleted, skipped } = await bulkDeleteManual(user.id, toSelection(s.data));
  revalidateTxns();
  if (deleted.length === 0) {
    return { message: skipped ? `Nothing deleted — ${skipped} imported row${skipped > 1 ? 's' : ''} can't be deleted` : 'Nothing to delete.' };
  }
  return { message: `Deleted ${deleted.length}${skipped ? ` · kept ${skipped} imported` : ''}`, undo: deleted };
}

// Undo a bulk delete — re-add every captured row. Each row is re-validated and account ownership is
// re-checked inside addTransaction, so a tampered undo payload can't insert into someone else's account.
const restoreSchema = z
  .array(
    z.object({
      accountId: z.string().uuid(),
      date: z.string().max(20),
      amount: z.number().int(),
      description: z.string().nullable(),
      merchant: z.string().nullable(),
      categoryId: z.string().uuid().nullable(),
      transactionType: z.enum(TXN_TYPES),
      status: z.enum(['POSTED', 'PENDING', 'REVERSED']),
    }),
  )
  .max(1000);

export async function bulkRestoreAction(rows: unknown): Promise<void> {
  const user = await requireUser();
  const parsed = restoreSchema.safeParse(rows);
  if (!parsed.success) return;
  for (const r of parsed.data) {
    try {
      await addTransaction(user.id, r as NewTransaction);
    } catch {
      /* skip a row that can't be restored (e.g. its account was since closed) */
    }
  }
  revalidateTxns();
}

export async function exportTransactionsAction(
  sel: unknown,
): Promise<{ csv: string; filename: string; message: string } | { message: string }> {
  const user = await requireUser();
  const s = selectionSchema.safeParse(sel);
  if (!s.success) return { message: 'Nothing to export.' };
  const { csv, rowCount, capped } = await exportTransactionsCsv(user.id, toSelection(s.data));
  const today = new Date().toISOString().slice(0, 10);
  return {
    csv,
    filename: `transactions-${today}.csv`,
    message: capped ? `Exported first ${rowCount.toLocaleString()} rows (capped)` : `Exported ${rowCount.toLocaleString()} row${rowCount === 1 ? '' : 's'}`,
  };
}

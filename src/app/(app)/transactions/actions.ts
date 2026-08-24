'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser } from '@/server/auth/session';
import { correctCategory, addTransaction, deleteTransaction } from '@/server/services/transactions';
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

export async function deleteTransactionAction(id: string): Promise<void> {
  const user = await requireUser();
  await deleteTransaction(user.id, id);
  revalidatePath('/transactions');
  revalidatePath('/dashboard');
}

'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser } from '@/server/auth/session';
import { createAccount, updateAccount, setAccountActive, getAccount, type AccountInput } from '@/server/services/accounts';
import { parseMoneyToPence } from '@/core/money';

export interface AccountFormState {
  error?: string;
}

const DEBT_TYPES = ['CREDIT_CARD', 'LOAN', 'MORTGAGE'];

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  institution: z.string().trim().max(80).optional(),
  accountType: z.enum(['CURRENT', 'SAVINGS', 'CREDIT_CARD', 'CASH_ISA', 'INVESTMENT', 'LOAN', 'MORTGAGE']),
  accessType: z.enum(['INSTANT', 'NOTICE', 'FIXED_TERM', 'RESTRICTED', 'UNKNOWN']),
  balance: z.string().trim(),
  interestRate: z.string().trim().optional(),
  taxWrapper: z.string().trim().optional(),
  purpose: z.string().trim().max(120).optional(),
  creditLimit: z.string().trim().optional(),
  minimumPayment: z.string().trim().optional(),
  paymentDueDay: z.string().trim().optional(),
  statementDay: z.string().trim().optional(),
});

function toInput(data: z.infer<typeof schema>, openingBalanceDate: string): AccountInput | { error: string } {
  const balPence = parseMoneyToPence(data.balance);
  if (balPence == null) return { error: 'Enter a valid balance amount.' };
  const isDebt = DEBT_TYPES.includes(data.accountType);
  // For debt accounts the user types the amount OWED as a positive number; store it negative.
  const openingBalance = isDebt ? -Math.abs(balPence) : balPence;
  const rate = data.interestRate ? Math.round(Number(data.interestRate) * 100) : 0;
  const day = (v?: string) => {
    const n = v ? parseInt(v, 10) : NaN;
    return Number.isInteger(n) && n >= 1 && n <= 31 ? n : null;
  };
  const money = (v?: string) => {
    const p = v ? parseMoneyToPence(v) : null;
    return p != null ? Math.abs(p) : null;
  };
  return {
    name: data.name,
    institution: data.institution || null,
    accountType: data.accountType,
    accessType: data.accessType,
    openingBalance,
    openingBalanceDate,
    interestRateBps: Number.isFinite(rate) ? Math.max(0, rate) : 0,
    taxWrapper: data.taxWrapper || null,
    purpose: data.purpose || null,
    creditLimit: isDebt ? money(data.creditLimit) : null,
    minimumPayment: isDebt ? money(data.minimumPayment) : null,
    paymentDueDay: isDebt ? day(data.paymentDueDay) : null,
    statementDay: isDebt ? day(data.statementDay) : null,
  };
}

const today = () => new Date().toISOString().slice(0, 10);

export async function createAccountAction(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const user = await requireUser();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid details' };
  const input = toInput(parsed.data, today());
  if ('error' in input) return { error: input.error };
  await createAccount(user.id, input);
  revalidatePath('/accounts');
  redirect('/accounts');
}

export async function updateAccountAction(id: string, _prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const user = await requireUser();
  const existing = await getAccount(user.id, id);
  if (!existing) return { error: 'Account not found.' };
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid details' };
  // Preserve the original opening-balance anchor date (the entered amount is still the opening balance).
  const input = toInput(parsed.data, existing.openingBalanceDate);
  if ('error' in input) return { error: input.error };
  await updateAccount(user.id, id, input);
  revalidatePath('/accounts');
  redirect('/accounts');
}

export async function deactivateAccountAction(id: string): Promise<{ message: string; undo: { id: string } }> {
  const user = await requireUser();
  const acct = await getAccount(user.id, id);
  await setAccountActive(user.id, id, false);
  revalidatePath('/accounts');
  revalidatePath('/dashboard');
  return { message: `Closed ${acct?.name ?? 'account'}`, undo: { id } };
}

// Undo a close — reactivate the same account (soft close, so nothing was lost).
export async function reactivateAccountAction(undo: { id: string }): Promise<void> {
  const user = await requireUser();
  await setAccountActive(user.id, undo.id, true);
  revalidatePath('/accounts');
  revalidatePath('/dashboard');
}

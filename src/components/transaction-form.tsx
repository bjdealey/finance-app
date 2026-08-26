'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import type { AccountRef } from '@/server/services/reference';
import { addTransactionAction, type TxnFormState } from '@/app/(app)/transactions/actions';
import { Card } from '@/components/ui';
import { Field, FormError, inputCls } from '@/components/form-ui';

const TYPES = [
  ['EXPENSE', 'Expense (money out)'],
  ['INCOME', 'Income (money in)'],
  ['REFUND', 'Refund (money in)'],
  ['INTEREST', 'Interest (money in)'],
  ['FEE', 'Fee (money out)'],
  ['CARD_PAYMENT', 'Card payment (money out)'],
] as const;

export function TransactionForm({ accounts, categories, today }: {
  accounts: AccountRef[];
  categories: { id: string; label: string }[];
  today: string;
}) {
  const [state, formAction, pending] = useActionState<TxnFormState, FormData>(addTransactionAction, {});

  return (
    <Card>
      <form action={formAction} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Account">
            <select name="accountId" required defaultValue="" className={inputCls}>
              <option value="" disabled>Choose account…</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
          <Field label="Date" hint="A future date records it as a planned item (shows in your forecast).">
            <input type="date" name="date" required defaultValue={today} className={inputCls} />
          </Field>
          <Field label="Type" hint="Sets whether the amount is money in or out.">
            <select name="transactionType" defaultValue="EXPENSE" className={inputCls}>
              {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="Amount (£)">
            <input name="amount" required inputMode="decimal" placeholder="0.00" className={inputCls} />
          </Field>
          <Field label="Description">
            <input name="description" maxLength={140} placeholder="e.g. Tesco groceries" className={inputCls} />
          </Field>
          <Field label="Category" hint="Optional">
            <select name="categoryId" defaultValue="" className={inputCls}>
              <option value="">Uncategorised</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </Field>
        </div>
        <FormError error={state.error} />
        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className="rounded-lg bg-primary-strong px-4 py-2 text-sm font-medium text-primary-fg disabled:opacity-50">
            {pending ? 'Adding…' : 'Add transaction'}
          </button>
          <Link href="/transactions" className="rounded-lg border border-border px-4 py-2 text-sm">Cancel</Link>
        </div>
      </form>
    </Card>
  );
}

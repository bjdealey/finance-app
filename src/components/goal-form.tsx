'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import type { GoalRow } from '@/server/db/schema';
import type { AccountRef } from '@/server/services/reference';
import type { GoalFormState } from '@/app/(app)/goals/actions';
import { penceToPounds } from '@/core/money';
import { Field, FormError, inputCls } from '@/components/form-ui';

export function GoalForm({ action, goal, accounts, compact }: {
  action: (prev: GoalFormState, formData: FormData) => Promise<GoalFormState>;
  goal?: GoalRow;
  accounts: AccountRef[];
  compact?: boolean;
}) {
  const [state, formAction, pending] = useActionState<GoalFormState, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Goal name">
          <input name="name" required maxLength={80} defaultValue={goal?.name ?? ''} placeholder="e.g. House deposit" className={inputCls} />
        </Field>
        <Field label="Target amount (£)">
          <input name="targetAmount" required inputMode="decimal" defaultValue={goal ? penceToPounds(goal.targetAmount) : ''} placeholder="0.00" className={inputCls} />
        </Field>
        <Field label="Target date" hint="Optional">
          <input type="date" name="targetDate" defaultValue={goal?.targetDate ?? ''} className={inputCls} />
        </Field>
        <Field label="Linked account" hint="Progress tracks this account's balance.">
          <select name="linkedAccountId" defaultValue={goal?.linkedAccountId ?? ''} className={inputCls}>
            <option value="">None</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        <Field label="Saved so far (£)" hint="Only used if no account is linked.">
          <input name="currentAmount" inputMode="decimal" defaultValue={goal && goal.currentAmount ? penceToPounds(goal.currentAmount) : ''} placeholder="0.00" className={inputCls} />
        </Field>
        <Field label="Priority" hint="Lower = more important.">
          <input name="priority" inputMode="numeric" defaultValue={goal?.priority ?? 100} className={inputCls} />
        </Field>
      </div>
      <FormError error={state.error} />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-lg bg-primary-strong px-4 py-2 text-sm font-medium text-primary-fg disabled:opacity-50">
          {pending ? 'Saving…' : goal ? 'Save changes' : 'Add goal'}
        </button>
        {!compact && <Link href="/goals" className="rounded-lg border border-border px-4 py-2 text-sm">Cancel</Link>}
      </div>
    </form>
  );
}

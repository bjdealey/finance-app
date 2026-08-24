'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import type { AccountRow } from '@/server/db/schema';
import type { AccountFormState } from '@/app/(app)/accounts/actions';
import { penceToPounds } from '@/core/money';
import { Card } from '@/components/ui';
import { Field, FormError, inputCls } from '@/components/form-ui';

const ACCOUNT_TYPES = [
  ['CURRENT', 'Current account'], ['SAVINGS', 'Savings'], ['CASH_ISA', 'Cash ISA'],
  ['INVESTMENT', 'Investment'], ['CREDIT_CARD', 'Credit card'], ['LOAN', 'Loan'], ['MORTGAGE', 'Mortgage'],
] as const;
const ACCESS_TYPES = [
  ['INSTANT', 'Instant access'], ['NOTICE', 'Notice'], ['FIXED_TERM', 'Fixed term'], ['RESTRICTED', 'Restricted'], ['UNKNOWN', 'Unknown'],
] as const;
const DEBT = new Set(['CREDIT_CARD', 'LOAN', 'MORTGAGE']);

export function AccountForm({ action, account }: {
  action: (prev: AccountFormState, formData: FormData) => Promise<AccountFormState>;
  account?: AccountRow;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [type, setType] = useState<string>(account?.accountType ?? 'CURRENT');
  const isDebt = DEBT.has(type);
  const money = (p: number | null | undefined) => (p == null ? '' : Math.abs(penceToPounds(p)));

  return (
    <Card>
      <form action={formAction} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Account name">
            <input name="name" required maxLength={80} defaultValue={account?.name ?? ''} placeholder="e.g. Main Current Account" className={inputCls} />
          </Field>
          <Field label="Bank / provider" hint="Optional">
            <input name="institution" maxLength={80} defaultValue={account?.institution ?? ''} placeholder="e.g. Barclays" className={inputCls} />
          </Field>
          <Field label="Type">
            <select name="accountType" value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
              {ACCOUNT_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="Access">
            <select name="accessType" defaultValue={account?.accessType ?? (isDebt ? 'UNKNOWN' : 'INSTANT')} className={inputCls}>
              {ACCESS_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label={isDebt ? 'Balance owed (£)' : 'Current balance (£)'} hint={account ? 'This is the opening-balance anchor; day-to-day balance comes from transactions.' : isDebt ? 'How much you currently owe.' : 'What the account holds today.'}>
            <input name="balance" required inputMode="decimal" defaultValue={money(account?.openingBalance)} placeholder="0.00" className={inputCls} />
          </Field>
          <Field label="Interest rate (% AER/APR)" hint="Optional">
            <input name="interestRate" inputMode="decimal" defaultValue={account ? account.interestRateBps / 100 : ''} placeholder="0.00" className={inputCls} />
          </Field>
        </div>

        {isDebt && (
          <div className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-2">
            <Field label="Credit limit (£)" hint="Optional">
              <input name="creditLimit" inputMode="decimal" defaultValue={money(account?.creditLimit)} placeholder="0.00" className={inputCls} />
            </Field>
            <Field label="Minimum payment (£)" hint="Optional">
              <input name="minimumPayment" inputMode="decimal" defaultValue={money(account?.minimumPayment)} placeholder="0.00" className={inputCls} />
            </Field>
            <Field label="Payment due day" hint="Day of month (1–31)">
              <input name="paymentDueDay" inputMode="numeric" defaultValue={account?.paymentDueDay ?? ''} placeholder="e.g. 15" className={inputCls} />
            </Field>
            <Field label="Statement day" hint="Day of month (1–31)">
              <input name="statementDay" inputMode="numeric" defaultValue={account?.statementDay ?? ''} placeholder="e.g. 1" className={inputCls} />
            </Field>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tax wrapper" hint="Optional">
            <select name="taxWrapper" defaultValue={account?.taxWrapper ?? ''} className={inputCls}>
              <option value="">None</option>
              <option value="CASH_ISA">Cash ISA</option>
              <option value="STOCKS_SHARES_ISA">Stocks &amp; Shares ISA</option>
            </select>
          </Field>
          <Field label="Purpose" hint="Optional">
            <input name="purpose" maxLength={120} defaultValue={account?.purpose ?? ''} placeholder="e.g. Emergency reserve" className={inputCls} />
          </Field>
        </div>

        <FormError error={state.error} />

        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-fg disabled:opacity-50">
            {pending ? 'Saving…' : account ? 'Save changes' : 'Add account'}
          </button>
          <Link href="/accounts" className="rounded-lg border border-border px-4 py-2 text-sm">Cancel</Link>
        </div>
      </form>
    </Card>
  );
}

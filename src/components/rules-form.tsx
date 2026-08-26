'use client';

import { useActionState } from 'react';
import type { AccountRef } from '@/server/services/reference';
import type { RulesInput } from '@/server/services/rules';
import { saveRulesAction, type RulesFormState } from '@/app/(app)/settings/actions';
import { penceToPounds } from '@/core/money';
import { Card } from '@/components/ui';
import { Field, FormError, inputCls } from '@/components/form-ui';

export function RulesForm({ rules, accounts }: { rules: RulesInput; accounts: AccountRef[] }) {
  const [state, formAction, pending] = useActionState<RulesFormState, FormData>(saveRulesAction, {});
  const dnt = new Set(rules.doNotTouchAccountIds);

  return (
    <Card>
      <form action={formAction} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Minimum current-account buffer (£)" hint="Cash to always keep available. Blank = auto (½ a month's spending).">
            <input name="minBalance" inputMode="decimal" defaultValue={rules.minBalancePence != null ? penceToPounds(rules.minBalancePence) : ''} placeholder="e.g. 1500" className={inputCls} />
          </Field>
          <Field label="Emergency fund (months of essentials)" hint="Target size of your emergency reserve. Blank = 3.">
            <input name="emergencyMonths" inputMode="numeric" defaultValue={rules.emergencyMonths ?? ''} placeholder="3" className={inputCls} />
          </Field>
        </div>

        <label className="flex items-start gap-3">
          <input type="checkbox" name="preferInstant" defaultChecked={rules.preferInstant} className="mt-0.5 h-4 w-4" />
          <span className="text-sm">
            <span className="font-medium">Prefer instant access.</span>{' '}
            <span className="text-muted">Only recommend moving spare cash to instant-access savings, even if a notice or fixed account pays more.</span>
          </span>
        </label>

        {accounts.length > 0 && (
          <div>
            <div className="text-sm font-medium">Don&apos;t touch these accounts</div>
            <p className="mb-2 text-xs text-muted">The optimiser will never suggest moving money out of a ticked account.</p>
            <div className="space-y-2">
              {accounts.map((a) => (
                <label key={a.id} className="flex items-center gap-3">
                  <input type="checkbox" name="doNotTouch" value={a.id} defaultChecked={dnt.has(a.id)} className="h-4 w-4" />
                  <span className="text-sm">{a.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <FormError error={state.error} />
        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className="rounded-lg bg-primary-strong px-4 py-2 text-sm font-medium text-primary-fg disabled:opacity-50">
            {pending ? 'Saving…' : 'Save settings'}
          </button>
          {state.ok && <span className="text-sm text-pos">Saved.</span>}
        </div>
      </form>
    </Card>
  );
}

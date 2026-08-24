'use client';

import { useActionState } from 'react';
import type { CategoryFormState } from '@/app/(app)/categories/actions';
import { Field, FormError, inputCls } from '@/components/form-ui';

export function CategoryForm({ action, roots }: {
  action: (prev: CategoryFormState, formData: FormData) => Promise<CategoryFormState>;
  roots: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState<CategoryFormState, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Name">
          <input name="name" required maxLength={60} placeholder="e.g. Childcare" className={inputCls} />
        </Field>
        <Field label="Parent" hint="Leave as top-level to create a new group.">
          <select name="parentId" defaultValue="" className={inputCls}>
            <option value="">Top-level category</option>
            {roots.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Field>
        <Field label="Type">
          <select name="kind" defaultValue="EXPENSE" className={inputCls}>
            <option value="EXPENSE">Expense</option>
            <option value="INCOME">Income</option>
            <option value="TRANSFER">Transfer</option>
            <option value="NEUTRAL">Neutral</option>
          </select>
        </Field>
      </div>
      <FormError error={state.error} />
      <button type="submit" disabled={pending} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-fg disabled:opacity-50">
        {pending ? 'Adding…' : 'Add category'}
      </button>
    </form>
  );
}

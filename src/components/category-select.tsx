'use client';

import { useTransition } from 'react';
import { correctCategoryAction } from '@/app/(app)/transactions/actions';

export function CategorySelect({
  txnId,
  categoryId,
  options,
}: {
  txnId: string;
  categoryId: string | null;
  options: { id: string; label: string }[];
}) {
  const [pending, start] = useTransition();
  return (
    <select
      defaultValue={categoryId ?? ''}
      disabled={pending}
      onChange={(e) => {
        const value = e.target.value;
        if (value) start(() => correctCategoryAction(txnId, value));
      }}
      className="max-w-[11rem] rounded-md border border-border bg-bg px-1.5 py-1 text-xs text-muted outline-none focus:border-primary disabled:opacity-50"
    >
      <option value="" disabled>
        Uncategorised
      </option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

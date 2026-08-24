import type { ReactNode } from 'react';

// Shared styling + wrappers for the data-entry forms (accounts, goals, rules, transactions).
export const inputCls =
  'w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary';

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function FormError({ error }: { error?: string | null }) {
  if (!error) return null;
  return <p className="rounded-lg bg-neg/10 px-3 py-2 text-sm text-neg">{error}</p>;
}

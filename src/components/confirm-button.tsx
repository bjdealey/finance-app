'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useToast } from './toast';

// Two-step confirm for a destructive action, with an Undo toast on success.
// First click arms an inline "Confirm / Cancel" (Cancel focused, Esc dismisses) so nothing fires on
// a stray click; Confirm runs `action`, which returns a user-facing message + an optional `undo`
// payload. The toast then offers Undo, which hands that payload to `onUndo` (the paired restore
// action). Prevention (confirm) and recovery (undo) together.
export function ConfirmButton<U>({
  children,
  confirmLabel = 'Confirm',
  title,
  ariaLabel,
  triggerClassName,
  confirmClassName = 'rounded-lg border border-neg px-2.5 py-1 text-xs font-medium text-neg transition hover:bg-neg/10 disabled:opacity-50',
  action,
  onUndo,
}: {
  children: React.ReactNode;
  confirmLabel?: string;
  title?: string;
  ariaLabel?: string;
  triggerClassName: string;
  confirmClassName?: string;
  action: () => Promise<{ message: string; undo?: U }>;
  onUndo?: (undo: U) => void | Promise<unknown>;
}) {
  const [armed, setArmed] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { if (armed) cancelRef.current?.focus(); }, [armed]);

  const run = () => start(async () => {
    try {
      const res = await action();
      setArmed(false);
      if (onUndo && res.undo !== undefined) {
        const payload = res.undo;
        toast({
          message: res.message,
          onUndo: () => { Promise.resolve(onUndo(payload)).catch(() => toast({ message: 'Could not undo — please try again.' })); },
        });
      } else {
        toast({ message: res.message });
      }
    } catch {
      setArmed(false);
      toast({ message: 'Something went wrong — please try again.' });
    }
  });

  if (!armed) {
    return (
      <button type="button" onClick={() => setArmed(true)} className={triggerClassName} title={title} aria-label={ariaLabel}>
        {children}
      </button>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-2 whitespace-nowrap"
      onKeyDown={(e) => { if (e.key === 'Escape' && !pending) setArmed(false); }}
    >
      <button type="button" onClick={run} disabled={pending} className={confirmClassName}>{confirmLabel}</button>
      <button
        ref={cancelRef}
        type="button"
        onClick={() => setArmed(false)}
        disabled={pending}
        className="text-xs text-muted transition hover:text-fg disabled:opacity-50"
      >
        Cancel
      </button>
    </span>
  );
}

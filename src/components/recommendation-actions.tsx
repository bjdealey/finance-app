'use client';

import { useState, useTransition } from 'react';
import { decideAction } from '@/app/(app)/recommendations/decide';
import type { Decision } from '@/server/services/recommendations';

export function RecommendationActions({ recId }: { recId: string }) {
  const [pending, start] = useTransition();
  const [active, setActive] = useState<Decision | null>(null);
  const decide = (status: Decision, snoozeDays?: number) => {
    setActive(status);
    start(() => decideAction(recId, status, snoozeDays));
  };
  // Only the button that was actually clicked shows the spinner.
  const busy = (s: Decision) => pending && active === s;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={() => decide('APPROVED')}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary-strong px-3 py-1.5 text-sm font-medium text-primary-fg disabled:opacity-50"
      >
        {busy('APPROVED') && <Spinner />}
        Approve
      </button>
      <button
        onClick={() => decide('SNOOZED', 30)}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-50"
      >
        {busy('SNOOZED') && <Spinner />}
        Snooze 30d
      </button>
      <button
        onClick={() => decide('REJECTED')}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted hover:text-fg disabled:opacity-50"
      >
        {busy('REJECTED') && <Spinner />}
        Dismiss
      </button>
      <span className="basis-full text-xs text-muted sm:ml-auto sm:basis-auto">Records intent only — no money moves.</span>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="spin" width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3" />
      <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

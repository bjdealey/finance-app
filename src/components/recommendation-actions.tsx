'use client';

import { useTransition } from 'react';
import type { Recommendation } from '@/core/recommend';
import { decideAction } from '@/app/(app)/recommendations/decide';
import type { Decision } from '@/server/services/recommendations';

export function RecommendationActions({ rec }: { rec: Recommendation }) {
  const [pending, start] = useTransition();
  const decide = (status: Decision, snoozeDays?: number) => start(() => decideAction(rec, status, snoozeDays));

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => decide('APPROVED')}
        disabled={pending}
        className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg disabled:opacity-50"
      >
        Approve
      </button>
      <button
        onClick={() => decide('SNOOZED', 30)}
        disabled={pending}
        className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-50"
      >
        Snooze 30d
      </button>
      <button
        onClick={() => decide('REJECTED')}
        disabled={pending}
        className="rounded-lg px-3 py-1.5 text-sm text-muted hover:text-fg disabled:opacity-50"
      >
        Dismiss
      </button>
      <span className="ml-auto text-xs text-muted">Records intent only — no money moves.</span>
    </div>
  );
}

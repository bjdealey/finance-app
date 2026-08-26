'use client'; // Error boundaries must be Client Components.

import { useEffect } from 'react';
import Link from 'next/link';

// Catches unexpected runtime errors from any authenticated page and renders WITHIN the app shell
// (nav + header stay put, so the user can navigate away). Hue = warn, not neg: this is a recoverable
// hiccup, not a loss — red stays reserved for destructive/negative money. `retry()` re-runs the
// failed segment (stable in Next 16.3); the digest is surfaced quietly as a support reference.
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="rise-in w-full max-w-md rounded-xl border border-border bg-surface p-8 text-center">
        <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-warn/10 text-warn">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0Z" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
        </div>
        <h1 className="mt-4 text-lg font-semibold tracking-tight">This view didn’t load</h1>
        <p className="mt-2 text-sm text-muted">
          Something on our side interrupted it. Your accounts and data are safe, and nothing was changed —
          try again in a moment.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={() => retry()}
            className="rounded-lg bg-primary-strong px-4 py-2 text-sm font-medium text-primary-fg"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition hover:bg-surface-2"
          >
            Back to dashboard
          </Link>
        </div>
        {error.digest && (
          <p className="mt-5 text-xs text-muted">
            Reference <span className="tnum">{error.digest}</span>
          </p>
        )}
      </div>
    </div>
  );
}

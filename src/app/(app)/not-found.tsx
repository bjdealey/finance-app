import Link from 'next/link';

// Rendered when notFound() is thrown inside the authenticated app — e.g. editing an account or goal
// whose id doesn't exist (see accounts/[id]/edit, goals/[id]/edit). Keeps the app shell so the user
// stays oriented, and offers the way back to the panels they use most. Neutral hue: a missing page is
// navigation, not caution or loss.
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="rise-in w-full max-w-md rounded-xl border border-border bg-surface p-8 text-center">
        <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-surface-2 text-muted">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path d="m9 15 2.2-5.8L15 9l-2.2 5.8L9 15Z" />
          </svg>
        </div>
        <h1 className="mt-4 text-lg font-semibold tracking-tight">We couldn’t find that page</h1>
        <p className="mt-2 text-sm text-muted">
          The link may be old, or the account or goal it pointed to has since been removed. Here’s the way
          back to solid ground.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Link href="/dashboard" className="rounded-lg bg-primary-strong px-4 py-2 text-sm font-medium text-primary-fg">
            Dashboard
          </Link>
          <Link href="/accounts" className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition hover:bg-surface-2">
            Accounts
          </Link>
          <Link href="/transactions" className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition hover:bg-surface-2">
            Transactions
          </Link>
        </div>
        <p className="mt-6 text-xs text-muted">Error 404 · page not found</p>
      </div>
    </div>
  );
}

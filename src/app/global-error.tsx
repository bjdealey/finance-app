'use client'; // Error boundaries must be Client Components.

// Last-resort boundary: catches a crash in the root layout itself, which no other error.tsx can reach.
// It replaces the whole document, so it must render its own <html>/<body> and pull in globals.css for
// tokens and fonts. The pre-paint theme script lives in the root layout that just failed, so there's no
// data-theme here — colours resolve from the OS scheme via light-dark(), which is the right fallback.
import './globals.css';

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-bg font-sans text-fg antialiased">
        <main className="grid min-h-dvh place-items-center px-6 py-16">
          <div className="w-full max-w-md text-center">
            <span className="mx-auto grid h-8 w-8 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-fg">F</span>
            <h1 className="mt-6 text-xl font-semibold tracking-tight">Something went wrong</h1>
            <p className="mt-2 text-sm text-muted">
              The app hit an unexpected error. Your data is safe and nothing was changed — reloading usually
              clears it.
            </p>
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                onClick={() => retry()}
                className="rounded-lg bg-primary-strong px-4 py-2 text-sm font-medium text-primary-fg"
              >
                Try again
              </button>
              <button
                onClick={() => location.reload()}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition hover:bg-surface-2"
              >
                Reload
              </button>
            </div>
            {error.digest && (
              <p className="mt-5 text-xs text-muted">
                Reference <span className="tnum">{error.digest}</span>
              </p>
            )}
          </div>
        </main>
      </body>
    </html>
  );
}

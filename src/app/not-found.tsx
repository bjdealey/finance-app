import Link from 'next/link';
import { DigbyMark } from '@/components/brand';

// Global 404 for URLs that match no route at all (reached by authenticated or signed-out visitors).
// Renders inside the root layout only — no app nav — so it stands on its own identity and points home.
// "/" resolves to the dashboard or the sign-in screen depending on session, so it's the safe way back
// for everyone.
export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 py-16">
      <div className="rise-in w-full max-w-md text-center">
        <Link href="/" className="inline-flex items-center gap-2">
          <DigbyMark size={32} />
          <span className="text-sm font-semibold tracking-tight">Digby</span>
        </Link>
        <h1 className="mt-8 text-xl font-semibold tracking-tight">We couldn’t find that page</h1>
        <p className="mt-2 text-sm text-muted">
          The link may be old or the address slightly off. Let’s get you back on track.
        </p>
        <div className="mt-6">
          <Link href="/" className="inline-flex rounded-lg bg-primary-strong px-4 py-2 text-sm font-medium text-primary-fg">
            Return home
          </Link>
        </div>
        <p className="mt-8 text-xs text-muted">Error 404 · page not found</p>
      </div>
    </main>
  );
}

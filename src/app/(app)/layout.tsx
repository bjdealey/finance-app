import Link from 'next/link';
import { requireUser } from '@/server/auth/session';
import { logoutAction } from '@/server/auth/actions';
import { NavLinks } from '@/components/nav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-border bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
          <Link href="/dashboard" className="text-sm font-semibold uppercase tracking-widest text-primary">
            Finance OS
          </Link>
          <NavLinks />
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-muted sm:inline">{user.name}</span>
            <form action={logoutAction}>
              <button className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-2">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      <footer className="mx-auto max-w-6xl px-6 py-8 text-xs text-muted">
        Financial planning suggestions and educational information — not regulated financial advice.
        No money is moved by this app.
      </footer>
    </div>
  );
}

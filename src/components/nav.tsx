'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/components/ui';
import { logoutAction } from '@/server/auth/actions';

type Item = { href: string; label: string };

// Primary items sit in the desktop bar; the rest live under "More" and in the mobile drawer.
// The order follows the money story: overview → holdings → history → future → action.
const PRIMARY: Item[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/accounts', label: 'Accounts' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/forecast', label: 'Forecast' },
  { href: '/recommendations', label: 'Recommendations' },
];
const MORE: Item[] = [
  { href: '/goals', label: 'Goals' },
  { href: '/behaviour', label: 'Behaviour' },
  { href: '/scenarios', label: 'What if?' },
  { href: '/health', label: 'Health' },
  { href: '/assistant', label: 'Assistant' },
  { href: '/categories', label: 'Categories' },
  { href: '/settings', label: 'Settings' },
];

export function AppHeader({ userName }: { userName: string }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');
  const moreActive = MORE.some((i) => isActive(i.href));

  // Close the desktop "More" popover on outside click / Escape. (A fixed backdrop can't be used
  // here — the header's backdrop-blur makes it a containing block that would clip a fixed overlay.)
  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: PointerEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMoreOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [moreOpen]);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:px-6">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2 pr-1" onClick={() => setDrawerOpen(false)}>
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary text-[13px] font-bold text-primary-fg">F</span>
            <span className="whitespace-nowrap text-sm font-semibold tracking-tight">Finance OS</span>
          </Link>

          {/* Horizontal nav — appears only once there's room to breathe (below lg it's the drawer). */}
          <nav className="ml-2 hidden items-center gap-0.5 lg:flex">
            {PRIMARY.map((i) => (
              <NavLink key={i.href} item={i} active={isActive(i.href)} />
            ))}
            <div className="relative" ref={moreRef}>
              <button
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                aria-expanded={moreOpen}
                aria-haspopup="menu"
                className={cn(
                  'flex items-center gap-1 rounded-lg px-3 py-2 text-sm transition',
                  moreActive || moreOpen ? 'bg-surface-2 text-fg' : 'text-muted hover:text-fg',
                )}
              >
                More
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className={cn('transition-transform', moreOpen && 'rotate-180')}>
                  <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {moreOpen && (
                <div role="menu" className="absolute right-0 z-50 mt-2 w-52 rounded-xl border border-border bg-surface p-1.5 shadow-lg shadow-black/5">
                  {MORE.map((i) => (
                    <Link
                      key={i.href}
                      href={i.href}
                      role="menuitem"
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        'block rounded-lg px-3 py-2 text-sm transition',
                        isActive(i.href) ? 'bg-surface-2 font-medium text-fg' : 'text-muted hover:bg-surface-2 hover:text-fg',
                      )}
                    >
                      {i.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </nav>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <span className="hidden text-sm text-muted lg:inline">{userName}</span>
            <form action={logoutAction} className="hidden lg:block">
              <button className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition hover:bg-surface-2 hover:text-fg">
                Sign out
              </button>
            </form>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              className="-mr-1 grid h-9 w-9 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-fg lg:hidden"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
                <path d="M3 6h14M3 10h14M3 14h14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Drawer — rendered outside the blurred header so `fixed` fills the viewport. */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-black/40 backdrop-blur-sm" aria-label="Close menu" onClick={() => setDrawerOpen(false)} />
          <div className="absolute right-0 top-0 flex h-full w-72 max-w-[82vw] flex-col border-l border-border bg-surface shadow-xl">
            <div className="flex h-16 items-center justify-between px-5">
              <span className="text-sm font-semibold tracking-tight">Menu</span>
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                className="-mr-1 grid h-9 w-9 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-fg"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
                  <path d="M4 4l10 10M14 4 4 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 pb-4">
              <div className="space-y-1">
                {PRIMARY.map((i) => (
                  <DrawerLink key={i.href} item={i} active={isActive(i.href)} onClick={() => setDrawerOpen(false)} />
                ))}
              </div>
              <div className="mb-1 mt-5 px-3 text-xs font-medium uppercase tracking-wider text-muted">More</div>
              <div className="space-y-1">
                {MORE.map((i) => (
                  <DrawerLink key={i.href} item={i} active={isActive(i.href)} onClick={() => setDrawerOpen(false)} />
                ))}
              </div>
            </nav>
            <div className="border-t border-border p-4">
              <div className="mb-3 px-1 text-sm text-muted">{userName}</div>
              <form action={logoutAction}>
                <button className="w-full rounded-lg border border-border px-3 py-2 text-sm transition hover:bg-surface-2">
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function NavLink({ item, active }: { item: Item; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={cn(
        'rounded-lg px-3 py-2 text-sm transition',
        active ? 'bg-surface-2 font-medium text-fg' : 'text-muted hover:text-fg',
      )}
    >
      {item.label}
    </Link>
  );
}

function DrawerLink({ item, active, onClick }: { item: Item; active: boolean; onClick: () => void }) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        'block rounded-lg px-3 py-2.5 text-[15px] transition',
        active ? 'bg-surface-2 font-medium text-fg' : 'text-muted hover:bg-surface-2 hover:text-fg',
      )}
    >
      {item.label}
    </Link>
  );
}

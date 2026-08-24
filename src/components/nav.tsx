'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/components/ui';

// Grows as milestones land (Forecast, Recommendations, Health).
const LINKS: { href: string; label: string }[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/accounts', label: 'Accounts' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/behaviour', label: 'Behaviour' },
  { href: '/forecast', label: 'Forecast' },
  { href: '/scenarios', label: 'What if?' },
  { href: '/recommendations', label: 'Recommendations' },
  { href: '/health', label: 'Health' },
  { href: '/assistant', label: 'Assistant' },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-1 md:flex">
      {LINKS.map((l) => {
        const active = pathname === l.href || pathname.startsWith(l.href + '/');
        return (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm transition',
              active ? 'bg-surface-2 font-medium text-fg' : 'text-muted hover:text-fg',
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

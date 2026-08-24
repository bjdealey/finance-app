'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/components/ui';

type Theme = 'system' | 'light' | 'dark';
const OPTIONS: { value: Theme; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

// "system" removes the override so the OS preference governs (via the CSS media query); light/dark
// force it. Matches the pre-paint script in layout.tsx (localStorage key 'theme').
function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'system') {
    root.removeAttribute('data-theme');
    localStorage.removeItem('theme');
  } else {
    root.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }
}

export function ThemeToggle() {
  // Start at 'system' to match SSR (localStorage is client-only), then reconcile after mount.
  const [theme, setTheme] = useState<Theme>('system');
  useEffect(() => {
    const stored = localStorage.getItem('theme');
    setTheme(stored === 'light' || stored === 'dark' ? stored : 'system');
  }, []);

  const select = (t: Theme) => {
    setTheme(t);
    apply(t);
  };

  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={theme === o.value}
          onClick={() => select(o.value)}
          className={cn(
            'rounded-md px-3.5 py-1.5 text-sm font-medium transition',
            theme === o.value ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

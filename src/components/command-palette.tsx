'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { NAV_ITEMS } from '@/lib/nav-items';
import { toggleTheme } from '@/lib/theme';
import { logoutAction } from '@/server/auth/actions';
import { cn } from '@/components/ui';

// Dispatch this on window to open the palette from elsewhere (the header ⌘K chip). Keeps the trigger
// decoupled from this component's state — no context provider, no prop drilling through the layout.
export const OPEN_PALETTE_EVENT = 'financeos:open-palette';

type Command = {
  id: string;
  group: 'Pages' | 'Actions';
  label: string;
  hint?: string;
  keywords?: string;
  run: () => void;
};

// A ⌘K command palette: keyboard reach to every one of the 12 pages and the core actions, in one
// searchable overlay. Combobox + listbox a11y pattern — the field keeps focus and drives an
// aria-activedescendant cursor over the options, so arrows/⏎ work for keyboard and the current row is
// announced to screen readers. Esc closes and returns focus; reduced-motion collapses the entrance.
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  const commands = useMemo<Command[]>(() => {
    const go = (href: string) => () => router.push(href);
    const pages: Command[] = NAV_ITEMS.map((i) => ({
      id: `page:${i.href}`,
      group: 'Pages',
      label: i.label,
      hint: i.href,
      run: go(i.href),
    }));
    const actions: Command[] = [
      { id: 'add-txn', group: 'Actions', label: 'Add transaction', keywords: 'new expense income entry', run: go('/transactions/new') },
      { id: 'import', group: 'Actions', label: 'Import CSV', keywords: 'upload bank statement', run: go('/transactions/import') },
      { id: 'new-account', group: 'Actions', label: 'New account', keywords: 'add bank savings', run: go('/accounts/new') },
      { id: 'new-goal', group: 'Actions', label: 'New goal', keywords: 'add target saving', run: go('/goals') },
      { id: 'new-category', group: 'Actions', label: 'New category', keywords: 'add tag label', run: go('/categories') },
      { id: 'theme', group: 'Actions', label: 'Toggle light / dark theme', keywords: 'dark mode appearance colour', run: toggleTheme },
      { id: 'signout', group: 'Actions', label: 'Sign out', keywords: 'logout log out exit', run: () => void logoutAction() },
    ];
    return [...pages, ...actions];
  }, [router]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => `${c.label} ${c.keywords ?? ''}`.toLowerCase().includes(q));
  }, [commands, query]);

  const activeIdx = Math.min(active, Math.max(0, results.length - 1));

  // Global ⌘K / Ctrl-K toggle + the header chip's open event. Always mounted, so these live app-wide.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
    };
  }, []);

  // On open: fresh query, focus the field, remember where focus was. On close: hand focus back.
  useEffect(() => {
    if (open) {
      restoreRef.current = document.activeElement as HTMLElement | null;
      setQuery('');
      setActive(0);
      const raf = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(raf);
    }
    restoreRef.current?.focus?.();
  }, [open]);

  // Lock background scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Keep the active row in view as the arrows move it.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx, open]);

  const runCommand = (cmd: Command | undefined) => {
    if (!cmd) return;
    setOpen(false);
    cmd.run();
  };

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActive((i) => Math.min(i + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
        break;
      case 'Home':
        e.preventDefault();
        setActive(0);
        break;
      case 'End':
        e.preventDefault();
        setActive(results.length - 1);
        break;
      case 'Enter':
        e.preventDefault();
        runCommand(results[activeIdx]);
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
      case 'Tab':
        e.preventDefault(); // the field is the only focusable — trap focus here; arrows drive the list
        break;
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close command palette"
        onClick={() => setOpen(false)}
        className="scrim-in absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="pop-in absolute inset-x-0 top-[12vh] mx-auto flex max-h-[70vh] w-[calc(100%-2rem)] max-w-xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-xl shadow-black/10"
      >
        <div className="flex items-center gap-2.5 border-b border-border px-4">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="shrink-0 text-muted">
            <circle cx="7" cy="7" r="4.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="m11 11 3.2 3.2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded={true}
            aria-controls="command-palette-list"
            aria-activedescendant={results[activeIdx] ? `command-${activeIdx}` : undefined}
            aria-label="Search pages and actions"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Search pages and actions…"
            className="w-full bg-transparent py-3.5 text-sm outline-none placeholder:text-muted"
          />
        </div>

        <div ref={listRef} id="command-palette-list" role="listbox" aria-label="Commands" className="min-h-0 flex-1 overflow-y-auto py-1.5">
          {results.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted">No matches for “{query.trim()}”.</p>
          ) : (
            results.map((cmd, i) => {
              const header = i === 0 || results[i - 1].group !== cmd.group;
              const isActive = i === activeIdx;
              return (
                <Fragment key={cmd.id}>
                  {header && (
                    <div aria-hidden className="px-4 pb-1 pt-3 text-xs font-medium uppercase tracking-wider text-muted [&:first-child]:pt-1.5">
                      {cmd.group}
                    </div>
                  )}
                  <div
                    id={`command-${i}`}
                    role="option"
                    aria-selected={isActive}
                    data-idx={i}
                    onPointerMove={() => setActive(i)}
                    onClick={() => runCommand(cmd)}
                    className={cn(
                      'mx-1.5 flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-sm text-fg',
                      isActive && 'bg-surface-2',
                    )}
                  >
                    <span>{cmd.label}</span>
                    {cmd.hint && <span className="shrink-0 text-xs text-muted">{cmd.hint}</span>}
                  </div>
                </Fragment>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2 text-xs text-muted">
          <span className="flex items-center gap-1">
            <Key>↑</Key>
            <Key>↓</Key>
            <span className="ml-1">navigate</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="flex items-center gap-1"><Key>↵</Key> open</span>
            <span className="flex items-center gap-1"><Key>esc</Key> close</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-5 items-center justify-center rounded border border-border bg-surface-2 px-1.5 py-0.5 font-sans text-xs leading-none text-muted">
      {children}
    </kbd>
  );
}

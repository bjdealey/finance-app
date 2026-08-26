'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type ToastItem = { id: number; message: string; onUndo?: () => void };
type PushToast = (t: { message: string; onUndo?: () => void }) => void;

const ToastContext = createContext<PushToast>(() => {});
export const useToast = (): PushToast => useContext(ToastContext);

let seq = 0; // client-only monotonic id (toasts are only created on interaction, never during SSR)

// Lightweight toast host. A destructive action pushes "<what> — Undo"; the undo runs the paired
// restore action. Toasts auto-dismiss after 9s, stack (newest at the bottom, max 3), and are a
// polite live region so screen readers announce them.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setItems((cur) => cur.filter((t) => t.id !== id));
  }, []);

  const push = useCallback<PushToast>((t) => {
    const id = ++seq;
    setItems((cur) => [...cur.slice(-2), { ...t, id }]);
    setTimeout(() => remove(id), 9000);
  }, [remove]);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4"
        role="region"
        aria-label="Notifications"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className="rise-in pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm shadow-lg shadow-black/10"
          >
            <span className="min-w-0 flex-1 truncate">{t.message}</span>
            {t.onUndo && (
              <button
                type="button"
                onClick={() => { t.onUndo!(); remove(t.id); }}
                className="shrink-0 font-medium text-primary-ink transition hover:underline"
              >
                Undo
              </button>
            )}
            <button
              type="button"
              onClick={() => remove(t.id)}
              aria-label="Dismiss"
              className="shrink-0 text-muted transition hover:text-fg"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

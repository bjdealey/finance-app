import type { ReactNode } from 'react';
import { formatGBP } from '@/core/money';

export function cn(...xs: (string | false | null | undefined)[]): string {
  return xs.filter(Boolean).join(' ');
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-xl border border-border bg-surface p-5 transition-colors duration-300', className)}>{children}</div>;
}

export function Money({
  pence,
  colored,
  signed,
  className,
}: {
  pence: number;
  colored?: boolean;
  signed?: boolean;
  className?: string;
}) {
  const color = colored ? (pence < 0 ? 'text-neg' : pence > 0 ? 'text-pos' : '') : '';
  return (
    <span className={cn('tnum whitespace-nowrap', color, className)}>
      {signed && pence > 0 ? '+' : ''}
      {formatGBP(pence)}
    </span>
  );
}

export function Badge({
  children,
  tone = 'default',
  className,
}: {
  children: ReactNode;
  tone?: 'default' | 'pos' | 'neg' | 'warn' | 'accent';
  className?: string;
}) {
  const tones: Record<string, string> = {
    default: 'bg-surface-2 text-muted',
    pos: 'bg-pos/10 text-pos',
    neg: 'bg-neg/10 text-neg',
    warn: 'bg-warn/10 text-warn',
    accent: 'bg-accent/10 text-accent',
  };
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', tones[tone], className)}>
      {children}
    </span>
  );
}

export function ProgressBar({ pct, tone = 'primary' }: { pct: number; tone?: 'primary' | 'pos' | 'warn' }) {
  const fill = tone === 'pos' ? 'bg-pos' : tone === 'warn' ? 'bg-warn' : 'bg-primary';
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
      <div className={cn('grow-x h-full rounded-full', fill)} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const max = Math.max(1, ...values);
  return (
    <div className={cn('flex h-8 items-end gap-px', className)} aria-hidden>
      {values.map((v, i) => (
        <div key={i} className="flex-1 rounded-sm bg-accent/40" style={{ height: `${Math.max(3, (v / max) * 100)}%` }} />
      ))}
    </div>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
    </div>
  );
}

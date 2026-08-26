'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Card, Money, Badge, cn } from '@/components/ui';
import { CategorySelect } from '@/components/category-select';
import { ConfirmButton } from '@/components/confirm-button';
import { useToast } from '@/components/toast';
import { formatDateShort } from '@/lib/format';
import {
  deleteTransactionAction,
  restoreTransactionAction,
  bulkRecategorizeAction,
  createRuleFromSelectionAction,
  bulkDeleteAction,
  bulkRestoreAction,
  exportTransactionsAction,
} from '@/app/(app)/transactions/actions';
import type { TxnListRow, TxnFilters, Selection, NewTransaction } from '@/server/services/transactions';

type CatOpt = { id: string; label: string };

const CTRL = 'rounded-lg border border-border px-2.5 py-1 text-xs font-medium transition disabled:opacity-50';

// The client selection layer over the server-rendered ledger. Row data, filters, and paging stay on
// the server; this owns only which rows are ticked and the bulk action bar. Selection is the current
// page's ids, or "all N matching this filter" — every bulk action sends one or the other to the server.
export function TransactionsTable({
  rows,
  catOpts,
  filter,
  total,
}: {
  rows: TxnListRow[];
  catOpts: CatOpt[];
  filter: TxnFilters;
  total: number;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const headRef = useRef<HTMLInputElement>(null);

  const pageIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const allPageSelected = rows.length > 0 && selected.size === rows.length;
  const count = allMatching ? total : selected.size;

  // When fresh server rows arrive (a page change, or rows deleted by a bulk action), drop any ticked
  // ids that no longer exist so the count can't drift above what's on screen.
  useEffect(() => {
    setSelected((cur) => {
      if (cur.size === 0) return cur;
      const live = new Set(pageIds);
      const next = new Set([...cur].filter((id) => live.has(id)));
      return next.size === cur.size ? cur : next;
    });
  }, [pageIds]);

  // The "select page" checkbox shows a dash when the page is only partly ticked.
  useEffect(() => {
    if (headRef.current) headRef.current.indeterminate = !allMatching && !allPageSelected && selected.size > 0;
  }, [allMatching, allPageSelected, selected.size]);

  const clear = () => {
    setSelected(new Set());
    setAllMatching(false);
  };

  const toggleRow = (id: string) => {
    setSelected((cur) => {
      const next = new Set(allMatching ? pageIds : cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setAllMatching(false);
  };

  const togglePage = () => {
    if (allMatching || allPageSelected) clear();
    else {
      setSelected(new Set(pageIds));
      setAllMatching(false);
    }
  };

  const selection = (): Selection => (allMatching ? { mode: 'filter', filter } : { mode: 'ids', ids: [...selected] });

  const runRecategorize = (categoryId: string) =>
    start(async () => {
      const r = await bulkRecategorizeAction(selection(), categoryId);
      clear();
      toast({ message: r.message });
    });

  const runCreateRule = (categoryId: string) =>
    start(async () => {
      const r = await createRuleFromSelectionAction(selection(), categoryId);
      clear();
      toast({ message: r.message });
    });

  const runExport = () =>
    start(async () => {
      const r = await exportTransactionsAction(selection());
      if ('csv' in r) downloadCsv(r.csv, r.filename);
      toast({ message: r.message });
    });

  return (
    <Card className="p-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-4 py-2.5">
        <input
          ref={headRef}
          type="checkbox"
          checked={allMatching || allPageSelected}
          onChange={togglePage}
          disabled={rows.length === 0}
          aria-label="Select all on this page"
          className="h-4 w-4 shrink-0 [accent-color:var(--primary-strong)]"
        />
        {count > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium" aria-live="polite">
              {count.toLocaleString()} selected
            </span>
            <span className="mx-0.5 hidden h-4 w-px bg-border sm:inline-block" aria-hidden />
            <BulkSelect label="Recategorise…" ariaLabel="Recategorise selected" options={catOpts} disabled={pending} onPick={runRecategorize} />
            <BulkSelect label="Make rule →…" ariaLabel="Create a category rule from selected" options={catOpts} disabled={pending} onPick={runCreateRule} />
            <button type="button" onClick={runExport} disabled={pending} className={cn(CTRL, 'hover:bg-surface-2')}>
              Export CSV
            </button>
            <ConfirmButton
              action={() => bulkDeleteAction(selection())}
              onUndo={(u: NewTransaction[]) => bulkRestoreAction(u)}
              triggerClassName={cn(CTRL, 'text-muted hover:bg-surface-2 hover:text-neg')}
              confirmLabel={`Delete ${count}`}
              ariaLabel={`Delete ${count} selected`}
            >
              Delete
            </ConfirmButton>
            <button type="button" onClick={clear} className="ml-0.5 text-xs text-muted transition hover:text-fg">
              Clear
            </button>
          </div>
        ) : (
          <span className="text-xs text-muted">Tick rows to recategorise, make a rule, export, or delete them together.</span>
        )}
      </div>

      {allPageSelected && !allMatching && total > rows.length && (
        <div className="border-b border-border bg-surface-2/40 px-4 py-2 text-center text-xs text-muted">
          All {rows.length} on this page are selected.{' '}
          <button type="button" onClick={() => setAllMatching(true)} className="font-medium text-primary-ink transition hover:underline">
            Select all {total.toLocaleString()} matching this filter
          </button>
        </div>
      )}
      {allMatching && (
        <div className="border-b border-border bg-surface-2/40 px-4 py-2 text-center text-xs text-muted">
          All {total.toLocaleString()} transactions matching this filter are selected.{' '}
          <button type="button" onClick={clear} className="font-medium text-primary-ink transition hover:underline">
            Clear selection
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[38rem] text-sm">
          <tbody className="divide-y divide-border">
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted">
                  No transactions match these filters.
                </td>
              </tr>
            )}
            {rows.map((t) => {
              const isTransfer = t.transactionType === 'TRANSFER' || t.transactionType === 'CARD_PAYMENT';
              const checked = allMatching || selected.has(t.id);
              return (
                <tr key={t.id} className={cn('transition-colors', checked && 'bg-surface-2/50')}>
                  <td className="w-9 py-2.5 pl-4">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleRow(t.id)}
                      aria-label={`Select ${t.merchant ?? t.description ?? 'transaction'}`}
                      className="h-4 w-4 [accent-color:var(--primary-strong)]"
                    />
                  </td>
                  <td className="w-20 py-2.5 text-muted">{formatDateShort(t.date)}</td>
                  <td className="py-2.5">
                    {t.merchant ?? t.description ?? '—'}
                    {t.status === 'PENDING' && (
                      <span className="ml-2">
                        <Badge tone="warn">planned</Badge>
                      </span>
                    )}
                  </td>
                  <td className="hidden py-2.5 text-muted lg:table-cell">{t.accountName}</td>
                  <td className="py-2.5">
                    {isTransfer ? (
                      <Badge>transfer</Badge>
                    ) : (
                      // Keyed on the category so a bulk recategorise (which changes it without the user
                      // touching this select) remounts it and the uncontrolled defaultValue reflects the update.
                      <CategorySelect key={t.categoryId ?? 'none'} txnId={t.id} categoryId={t.categoryId} options={catOpts} />
                    )}
                  </td>
                  <td className="py-2.5 text-right">
                    <Money pence={t.amount} colored signed />
                  </td>
                  <td className="py-2.5 pl-2 pr-4 text-right align-middle whitespace-nowrap">
                    {t.source === 'MANUAL' && (
                      <ConfirmButton
                        action={deleteTransactionAction.bind(null, t.id)}
                        onUndo={restoreTransactionAction}
                        triggerClassName="text-base leading-none text-muted transition hover:text-neg"
                        title="Delete this manual entry"
                        ariaLabel="Delete transaction"
                        confirmLabel="Delete"
                      >
                        ×
                      </ConfirmButton>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// A native select styled as a bar control: choosing a category runs the action, then it snaps back to
// its placeholder label so it reads as a menu, not a persistent value.
function BulkSelect({
  label,
  ariaLabel,
  options,
  disabled,
  onPick,
}: {
  label: string;
  ariaLabel: string;
  options: CatOpt[];
  disabled: boolean;
  onPick: (categoryId: string) => void;
}) {
  return (
    <select
      aria-label={ariaLabel}
      disabled={disabled}
      value=""
      onChange={(e) => {
        const v = e.target.value;
        e.target.value = '';
        if (v) onPick(v);
      }}
      className={cn(CTRL, 'bg-surface outline-none focus:border-primary')}
    >
      <option value="" disabled>
        {label}
      </option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

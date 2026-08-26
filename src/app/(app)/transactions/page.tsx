import Link from 'next/link';
import { requireUser } from '@/server/auth/session';
import { listTransactions, type TxnFilters } from '@/server/services/transactions';
import { listAccounts, listCategories, categoryOptions } from '@/server/services/reference';
import type { TransactionType } from '@/core/types';
import { PageHeader } from '@/components/ui';
import { TransactionsTable } from '@/components/transactions-table';

const TYPES: TransactionType[] = ['INCOME', 'EXPENSE', 'TRANSFER', 'REFUND', 'INTEREST', 'FEE', 'CARD_PAYMENT', 'UNKNOWN'];
const PAGE_SIZE = 50;

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const page = Math.max(1, Number(one(sp.page) ?? '1') || 1);

  const filters: TxnFilters = {
    search: one(sp.search),
    accountId: one(sp.accountId),
    categoryId: one(sp.categoryId),
    type: one(sp.type) as TransactionType | undefined,
    dateFrom: one(sp.dateFrom),
    dateTo: one(sp.dateTo),
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  };

  const [{ rows, total }, accts, cats] = await Promise.all([
    listTransactions(user.id, filters),
    listAccounts(user.id),
    listCategories(user.id),
  ]);
  const catOpts = categoryOptions(cats);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const qs = (overrides: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...stripPaging(filters), page, ...overrides })) {
      const s = v === undefined ? '' : String(v);
      if (s !== '') p.set(k, s);
    }
    return `?${p.toString()}`;
  };

  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-4">
        <PageHeader title="Transactions" subtitle={`${total.toLocaleString()} transactions`} />
        <div className="flex shrink-0 gap-2">
          <Link href="/transactions/new" className="rounded-lg bg-primary-strong px-3 py-2 text-sm font-medium text-primary-fg">Add</Link>
          <Link href="/transactions/import" className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-surface-2">Import CSV</Link>
        </div>
      </div>

      <form className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-6" method="get">
        <input name="search" defaultValue={filters.search ?? ''} placeholder="Search merchant…" className="col-span-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary md:col-span-2" />
        <Select name="accountId" defaultValue={filters.accountId ?? ''} placeholder="All accounts">
          {accts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </Select>
        <Select name="categoryId" defaultValue={filters.categoryId ?? ''} placeholder="All categories">
          {catOpts.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </Select>
        <Select name="type" defaultValue={filters.type ?? ''} placeholder="All types">
          {TYPES.map((t) => (
            <option key={t} value={t}>{t.toLowerCase().replace('_', ' ')}</option>
          ))}
        </Select>
        <div className="flex gap-2">
          <button className="flex-1 rounded-lg bg-fg px-3 py-2 text-sm font-medium text-bg" type="submit">Filter</button>
          <Link href="/transactions" className="rounded-lg border border-border px-3 py-2 text-sm">Clear</Link>
        </div>
        <input type="date" name="dateFrom" defaultValue={filters.dateFrom ?? ''} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary" />
        <input type="date" name="dateTo" defaultValue={filters.dateTo ?? ''} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary" />
      </form>

      <TransactionsTable
        rows={rows}
        catOpts={catOpts}
        total={total}
        filter={{
          search: filters.search,
          accountId: filters.accountId,
          categoryId: filters.categoryId,
          type: filters.type,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
        }}
      />

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 && <Link href={qs({ page: page - 1 })} className="rounded-lg border border-border px-3 py-1.5">Previous</Link>}
            {page < totalPages && <Link href={qs({ page: page + 1 })} className="rounded-lg border border-border px-3 py-1.5">Next</Link>}
          </div>
        </div>
      )}
    </div>
  );
}

function stripPaging(f: TxnFilters): Record<string, string | undefined> {
  return {
    search: f.search,
    accountId: f.accountId,
    categoryId: f.categoryId,
    type: f.type,
    dateFrom: f.dateFrom,
    dateTo: f.dateTo,
  };
}

function Select({ name, defaultValue, placeholder, children }: {
  name: string;
  defaultValue: string;
  placeholder: string;
  children: React.ReactNode;
}) {
  return (
    <select name={name} defaultValue={defaultValue} className="rounded-lg border border-border bg-surface px-2 py-2 text-sm outline-none focus:border-primary">
      <option value="">{placeholder}</option>
      {children}
    </select>
  );
}

import Link from 'next/link';
import { requireUser } from '@/server/auth/session';
import { loadSnapshot } from '@/server/services/snapshot';
import { computeBalances } from '@/core/ledger';
import type { AccountType } from '@/core/types';
import { Card, Money, Badge, PageHeader } from '@/components/ui';
import { deactivateAccountAction, reactivateAccountAction } from './actions';
import { ConfirmButton } from '@/components/confirm-button';

const GROUPS: { key: string; types: AccountType[] }[] = [
  { key: 'Current accounts', types: ['CURRENT'] },
  { key: 'Savings', types: ['SAVINGS'] },
  { key: 'Cash ISAs', types: ['CASH_ISA'] },
  { key: 'Investments', types: ['INVESTMENT'] },
  { key: 'Credit', types: ['CREDIT_CARD'] },
  { key: 'Loans & mortgages', types: ['LOAN', 'MORTGAGE'] },
];

const ACCESS_LABEL: Record<string, string> = {
  INSTANT: 'instant access',
  NOTICE: 'notice',
  FIXED_TERM: 'fixed term',
  RESTRICTED: 'restricted',
  UNKNOWN: '',
};

export default async function AccountsPage() {
  const user = await requireUser();
  const snapshot = await loadSnapshot(user.id);
  const balances = new Map(computeBalances(snapshot).map((b) => [b.accountId, b]));

  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-4">
        <PageHeader title="Accounts" subtitle="Everything in one place, grouped by purpose." />
        <Link href="/accounts/new" className="shrink-0 rounded-lg bg-primary-strong px-3 py-2 text-sm font-medium text-primary-fg">
          Add account
        </Link>
      </div>

      {snapshot.accounts.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">No accounts yet. Add your current account, savings, cards and more — then import or add transactions to see your full picture.</p>
          <Link href="/accounts/new" className="mt-4 inline-block rounded-lg bg-primary-strong px-4 py-2 text-sm font-medium text-primary-fg">Add your first account</Link>
        </Card>
      ) : (
        <div className="space-y-6">
          {GROUPS.map((g) => {
            const accts = snapshot.accounts.filter((a) => g.types.includes(a.accountType));
            if (accts.length === 0) return null;
            const subtotal = accts.reduce((s, a) => s + (balances.get(a.id)?.balance ?? 0), 0);
            return (
              <Card key={g.key} className="p-0">
                <div className="flex items-center justify-between border-b border-border px-5 py-3">
                  <h2 className="font-semibold">{g.key}</h2>
                  <Money pence={subtotal} className="text-sm text-muted" />
                </div>
                <ul className="divide-y divide-border">
                  {accts.map((a) => {
                    const b = balances.get(a.id);
                    const isCard = a.accountType === 'CREDIT_CARD';
                    return (
                      <li key={a.id} className="flex items-center justify-between gap-4 px-5 py-4">
                        <div className="min-w-0">
                          <div className="font-medium">{a.name}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                            {a.institution && <span>{a.institution}</span>}
                            {a.interestRateBps > 0 && <Badge tone="accent">{(a.interestRateBps / 100).toFixed(2)}%{isCard ? ' APR' : ' AER'}</Badge>}
                            {ACCESS_LABEL[a.accessType] && <Badge>{ACCESS_LABEL[a.accessType]}</Badge>}
                            {a.taxWrapper && <Badge tone="pos">{a.taxWrapper.replace(/_/g, ' ').toLowerCase()}</Badge>}
                            {a.purpose && <span>· {a.purpose}</span>}
                          </div>
                          {isCard && a.creditLimit != null && (
                            <div className="mt-1 text-xs text-muted">
                              Limit <Money pence={a.creditLimit} /> · available <Money pence={b?.available ?? 0} />
                              {a.paymentDueDay && ` · payment due day ${a.paymentDueDay}`}
                            </div>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-4">
                          <Money pence={b?.balance ?? 0} colored={isCard} className="text-lg font-semibold" />
                          <div className="flex flex-col items-end gap-1 text-xs">
                            <Link href={`/accounts/${a.id}/edit`} className="text-muted hover:text-fg">Edit</Link>
                            <ConfirmButton
                              action={deactivateAccountAction.bind(null, a.id)}
                              onUndo={reactivateAccountAction}
                              triggerClassName="text-muted transition hover:text-neg"
                              title="Close this account — hides it from your financial picture"
                              confirmLabel="Close account"
                            >
                              Close
                            </ConfirmButton>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

import Link from 'next/link';
import { requireUser } from '@/server/auth/session';
import { listAccounts, listCategories, categoryOptions } from '@/server/services/reference';
import { Card, PageHeader } from '@/components/ui';
import { TransactionForm } from '@/components/transaction-form';

export default async function NewTransactionPage() {
  const user = await requireUser();
  const [accounts, cats] = await Promise.all([listAccounts(user.id), listCategories(user.id)]);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="max-w-2xl">
      <Link href="/transactions" className="text-sm text-muted hover:text-fg">← Transactions</Link>
      <PageHeader title="Add transaction" subtitle="Record a transaction on one of your accounts by hand." />
      {accounts.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">You need an account first.</p>
          <Link href="/accounts/new" className="mt-4 inline-block rounded-lg bg-primary-strong px-4 py-2 text-sm font-medium text-primary-fg">Add an account</Link>
        </Card>
      ) : (
        <TransactionForm accounts={accounts} categories={categoryOptions(cats)} today={today} />
      )}
    </div>
  );
}

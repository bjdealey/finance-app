import Link from 'next/link';
import { requireUser } from '@/server/auth/session';
import { PageHeader } from '@/components/ui';
import { AccountForm } from '@/components/account-form';
import { createAccountAction } from '../actions';

export default async function NewAccountPage() {
  await requireUser();
  return (
    <div className="max-w-2xl">
      <Link href="/accounts" className="text-sm text-muted hover:text-fg">← Accounts</Link>
      <PageHeader title="Add account" subtitle="Add a current account, savings, ISA, investment, card, loan, or mortgage." />
      <AccountForm action={createAccountAction} />
    </div>
  );
}

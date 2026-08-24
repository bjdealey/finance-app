import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/server/auth/session';
import { getAccount } from '@/server/services/accounts';
import { PageHeader } from '@/components/ui';
import { AccountForm } from '@/components/account-form';
import { updateAccountAction } from '../../actions';

export default async function EditAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const account = await getAccount(user.id, id);
  if (!account) notFound();

  return (
    <div className="max-w-2xl">
      <Link href="/accounts" className="text-sm text-muted hover:text-fg">← Accounts</Link>
      <PageHeader title="Edit account" subtitle={account.name} />
      <AccountForm action={updateAccountAction.bind(null, id)} account={account} />
    </div>
  );
}

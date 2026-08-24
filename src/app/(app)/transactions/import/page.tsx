import Link from 'next/link';
import { requireUser } from '@/server/auth/session';
import { listAccounts } from '@/server/services/reference';
import { PageHeader } from '@/components/ui';
import { ImportWizard } from '@/components/import-wizard';

export default async function ImportPage() {
  const user = await requireUser();
  const accounts = await listAccounts(user.id);
  return (
    <div className="max-w-3xl">
      <Link href="/transactions" className="text-sm text-muted hover:text-fg">← Transactions</Link>
      <div className="mt-2">
        <PageHeader
          title="Import transactions"
          subtitle="Upload a CSV export from your bank. Columns are auto-detected; you can adjust the mapping before importing. Duplicates are skipped and internal transfers are detected automatically."
        />
      </div>
      <ImportWizard accounts={accounts} />
    </div>
  );
}

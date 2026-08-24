import { requireUser } from '@/server/auth/session';
import { getUserRulesForEdit } from '@/server/services/rules';
import { listAccounts } from '@/server/services/reference';
import { PageHeader } from '@/components/ui';
import { RulesForm } from '@/components/rules-form';

const NON_DEBT = ['CURRENT', 'SAVINGS', 'CASH_ISA', 'INVESTMENT'];

export default async function SettingsPage() {
  const user = await requireUser();
  const [rules, accounts] = await Promise.all([getUserRulesForEdit(user.id), listAccounts(user.id)]);
  const touchable = accounts.filter((a) => NON_DEBT.includes(a.accountType));

  return (
    <div className="max-w-2xl">
      <PageHeader title="Settings" subtitle="Rules that guide how recommendations move your money. The engine treats these as hard constraints — nothing it suggests will ever breach them." />
      <RulesForm rules={rules} accounts={touchable} />
    </div>
  );
}

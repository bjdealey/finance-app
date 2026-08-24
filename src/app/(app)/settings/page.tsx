import { requireUser } from '@/server/auth/session';
import { getUserRulesForEdit } from '@/server/services/rules';
import { listAccounts } from '@/server/services/reference';
import { Card, PageHeader } from '@/components/ui';
import { RulesForm } from '@/components/rules-form';
import { ThemeToggle } from '@/components/theme-toggle';

const NON_DEBT = ['CURRENT', 'SAVINGS', 'CASH_ISA', 'INVESTMENT'];

export default async function SettingsPage() {
  const user = await requireUser();
  const [rules, accounts] = await Promise.all([getUserRulesForEdit(user.id), listAccounts(user.id)]);
  const touchable = accounts.filter((a) => NON_DEBT.includes(a.accountType));

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Settings" subtitle="Rules that guide how recommendations move your money. The engine treats these as hard constraints — nothing it suggests will ever breach them." />
      <Card>
        <h2 className="font-semibold">Appearance</h2>
        <p className="mt-0.5 mb-3 text-xs text-muted">Pick a theme, or follow your device setting.</p>
        <ThemeToggle />
      </Card>
      <RulesForm rules={rules} accounts={touchable} />
    </div>
  );
}

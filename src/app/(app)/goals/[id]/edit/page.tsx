import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/server/auth/session';
import { getGoal } from '@/server/services/goals';
import { listAccounts } from '@/server/services/reference';
import { Card, PageHeader } from '@/components/ui';
import { GoalForm } from '@/components/goal-form';
import { updateGoalAction } from '../../actions';

export default async function EditGoalPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const [goal, accounts] = await Promise.all([getGoal(user.id, id), listAccounts(user.id)]);
  if (!goal) notFound();

  return (
    <div className="max-w-2xl">
      <Link href="/goals" className="text-sm text-muted hover:text-fg">← Goals</Link>
      <PageHeader title="Edit goal" subtitle={goal.name} />
      <Card>
        <GoalForm action={updateGoalAction.bind(null, id)} goal={goal} accounts={accounts} />
      </Card>
    </div>
  );
}

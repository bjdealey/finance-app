import Link from 'next/link';
import { requireUser } from '@/server/auth/session';
import { getAnalysis } from '@/server/services/analysis';
import { Card, Money, Badge, ProgressBar, PageHeader } from '@/components/ui';
import { GoalForm } from '@/components/goal-form';
import { createGoalAction, deleteGoalAction } from './actions';
import { formatDate } from '@/lib/format';

export default async function GoalsPage() {
  const user = await requireUser();
  const a = await getAnalysis(user.id);
  const accounts = a.snapshot.accounts.map((x) => ({ id: x.id, name: x.name, accountType: x.accountType }));

  return (
    <div className="max-w-3xl">
      <PageHeader title="Goals" subtitle="What you're saving toward. The forecast tracks whether each goal is on pace." />

      {a.goals.length === 0 ? (
        <Card className="mb-8"><p className="text-sm text-muted">No goals yet. Add one below to start tracking progress.</p></Card>
      ) : (
        <div className="mb-8 space-y-4">
          {a.goals.map((g) => (
            <Card key={g.goal.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-medium">{g.goal.name}</div>
                  <div className="mt-0.5 text-sm text-muted">
                    <Money pence={g.currentAmount} /> of <Money pence={g.goal.targetAmount} />
                    {g.goal.targetDate && <> · by {formatDate(g.goal.targetDate)}</>}
                    {g.requiredMonthly != null && <> · needs <Money pence={g.requiredMonthly} />/mo</>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs">
                  <Link href={`/goals/${g.goal.id}/edit`} className="text-muted hover:text-fg">Edit</Link>
                  <form action={deleteGoalAction.bind(null, g.goal.id)}>
                    <button className="text-muted hover:text-neg">Delete</button>
                  </form>
                </div>
              </div>
              <div className="mt-3"><ProgressBar pct={g.progressPct} tone={g.onTrack === false ? 'warn' : 'pos'} /></div>
              <div className="mt-1 flex items-center justify-between text-xs text-muted">
                <span>{g.progressPct}%</span>
                {g.onTrack === false ? <Badge tone="warn">behind</Badge> : g.onTrack ? <Badge tone="pos">on track</Badge> : <span>no target date</span>}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <h2 className="mb-4 font-semibold">Add a goal</h2>
        <GoalForm action={createGoalAction} accounts={accounts} compact />
      </Card>
    </div>
  );
}

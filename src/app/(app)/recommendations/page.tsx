import { requireUser } from '@/server/auth/session';
import { getAnalysis } from '@/server/services/analysis';
import { getDecisions } from '@/server/services/recommendations';
import { Card, Money, Badge, PageHeader } from '@/components/ui';
import { RecommendationCard } from '@/components/recommendation-card';
import { RecommendationActions } from '@/components/recommendation-actions';
import { formatDate } from '@/lib/format';

export default async function RecommendationsPage() {
  const user = await requireUser();
  const { recommendations, liquidity, snapshot, optimisation } = await getAnalysis(user.id);
  const accountName = new Map(snapshot.accounts.map((a) => [a.id, a.name]));
  const decisions = await getDecisions(user.id);
  const now = new Date();

  const pending = recommendations.filter((r) => {
    const d = decisions.get(r.id);
    if (!d) return true;
    if (d.status === 'SNOOZED' && d.snoozeUntil && d.snoozeUntil > now) return false;
    if (d.status === 'APPROVED' || d.status === 'REJECTED') return false;
    return true; // snooze expired → pending again
  });

  const recorded = [...decisions.values()]
    .filter((d) => d.status === 'APPROVED' || d.status === 'REJECTED')
    .sort((a, b) => (b.decidedAt?.getTime() ?? 0) - (a.decidedAt?.getTime() ?? 0));

  return (
    <div>
      <PageHeader title="Recommendations" subtitle="Deterministic suggestions from your financial position — every one shows its full reasoning. Nothing here moves money." />

      <Card className="mb-6 bg-surface-2">
        <div className="flex flex-wrap gap-x-10 gap-y-3 text-sm">
          <Stat label="Movable surplus identified" value={optimisation.surplus} />
          <Stat label="Buffer kept in current account" value={liquidity.requiredCashBuffer} />
          <Stat label="30-day low point (protected)" value={liquidity.thirtyDayTrough} />
        </div>
      </Card>

      {pending.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">Nothing pending — your cash is well placed, or you&apos;ve actioned everything current.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {pending.map((rec) => (
            <RecommendationCard key={rec.id} rec={rec} accountName={accountName} footer={<RecommendationActions recId={rec.id} />} />
          ))}
        </div>
      )}

      {recorded.length > 0 && (
        <>
          <h2 className="mt-10 mb-3 font-semibold">Recorded decisions</h2>
          <Card className="p-0">
            <ul className="divide-y divide-border">
              {recorded.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                  <span className="min-w-0 truncate">{d.explanationTrace?.what ?? d.type}</span>
                  <span className="flex shrink-0 items-center gap-3 text-muted">
                    {d.decidedAt && <span className="text-xs">{formatDate(d.decidedAt.toISOString().slice(0, 10))}</span>}
                    <Badge tone={d.status === 'APPROVED' ? 'pos' : 'default'}>{d.status.toLowerCase()}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      <p className="mt-8 text-xs text-muted">
        These are financial planning suggestions and educational information, not regulated financial advice. Approving records
        your intent — it never moves money (execution is a disabled boundary in this MVP).
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-muted">{label}</div>
      <div className="text-xl font-semibold"><Money pence={value} /></div>
    </div>
  );
}

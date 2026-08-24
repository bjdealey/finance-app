import { requireUser } from '@/server/auth/session';
import { loadSnapshot } from '@/server/services/snapshot';
import { forecast, type ForecastSource } from '@/core/forecast';
import { Card, Money, Badge, PageHeader } from '@/components/ui';
import { formatDateShort } from '@/lib/format';

const HORIZON_LABEL: Record<number, string> = { 7: 'In 7 days', 30: 'In 30 days', 90: 'In 90 days', 365: 'In 12 months' };
const SOURCE_TONE: Record<ForecastSource, 'pos' | 'accent' | 'warn' | 'default'> = {
  KNOWN: 'pos',
  RECURRING: 'accent',
  PREDICTED: 'warn',
  USER_ENTERED: 'default',
};

export default async function ForecastPage() {
  const user = await requireUser();
  const snapshot = await loadSnapshot(user.id);
  const horizons = [7, 30, 90, 365].map((h) => forecast(snapshot, h));
  const detail = horizons[1]; // 30-day breakdown

  return (
    <div>
      <PageHeader title="Cash-flow forecast" subtitle="Projected from your recurring income and bills (dated) plus your typical discretionary spending (estimated). Predicted amounts are never presented as guaranteed." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {horizons.map((f) => {
          const net = f.projectedBalance - f.openingBalance;
          return (
            <Card key={f.horizonDays}>
              <div className="text-sm text-muted">{HORIZON_LABEL[f.horizonDays]}</div>
              <div className="mt-1 text-2xl font-semibold"><Money pence={f.projectedBalance} /></div>
              <div className="mt-1 text-sm"><Money pence={net} colored signed /> projected</div>
              <div className="mt-2 text-xs text-muted">
                Range <Money pence={f.low} />–<Money pence={f.high} />
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mt-8 flex items-center gap-4 text-xs text-muted">
        <span>Sources:</span>
        <Badge tone="accent">recurring</Badge>
        <Badge tone="warn">predicted</Badge>
        <Badge tone="pos">known</Badge>
      </div>

      <h2 className="mt-6 mb-3 font-semibold">Next 30 days — how we get there</h2>
      <Card className="p-0">
        <div className="flex items-center justify-between border-b border-border px-5 py-3 text-sm">
          <span className="text-muted">Current-account balance today</span>
          <Money pence={detail.openingBalance} className="font-medium" />
        </div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-border">
            {detail.items.filter((i) => i.amount !== 0).map((i, idx) => (
              <tr key={idx}>
                <td className="w-20 py-2.5 pl-5 text-muted">{formatDateShort(i.date)}</td>
                <td className="py-2.5">{i.label}</td>
                <td className="py-2.5"><Badge tone={SOURCE_TONE[i.source]}>{i.source.toLowerCase()}</Badge></td>
                <td className="py-2.5 pr-5 text-right"><Money pence={i.amount} colored signed /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <span className="font-medium">Projected balance in 30 days</span>
          <div className="text-right">
            <Money pence={detail.projectedBalance} className="text-lg font-semibold" />
            <div className="text-xs text-muted">range <Money pence={detail.low} />–<Money pence={detail.high} /></div>
          </div>
        </div>
      </Card>
    </div>
  );
}

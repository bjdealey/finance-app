import { requireUser } from '@/server/auth/session';
import { loadSnapshot } from '@/server/services/snapshot';
import { analyseCategories, analyseSavings } from '@/core/behaviour';
import { computeSignals } from '@/core/signals';
import type { ConfidenceTier } from '@/core/types';
import { categoryLabels } from '@/lib/categories';
import { Card, Money, Badge, Sparkline, PageHeader } from '@/components/ui';

const CONF_TONE: Record<ConfidenceTier, 'pos' | 'accent' | 'warn' | 'default'> = {
  HIGH: 'pos',
  MEDIUM: 'accent',
  LOW: 'warn',
  INSUFFICIENT_DATA: 'default',
};
const CONF_LABEL: Record<ConfidenceTier, string> = {
  HIGH: 'high confidence',
  MEDIUM: 'medium confidence',
  LOW: 'low confidence',
  INSUFFICIENT_DATA: 'insufficient data',
};
const TREND = { RISING: '↑ rising', FALLING: '↓ easing', STABLE: '→ steady' };

export default async function BehaviourPage() {
  const user = await requireUser();
  const snapshot = await loadSnapshot(user.id);
  const labels = categoryLabels(snapshot.categories);

  const stats = analyseCategories(snapshot).filter((s) => s.monthlyAverage > 0).slice(0, 14);
  const savings = analyseSavings(snapshot);
  const signals = computeSignals(snapshot);
  const totalMonthly = analyseCategories(snapshot).reduce((sum, c) => sum + c.monthlyAverage, 0);

  return (
    <div>
      <PageHeader title="Spending behaviour" subtitle="What your money actually does — measured from your last 12 months, not what you intended." />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <div className="text-sm text-muted">Your actual monthly spending</div>
          <div className="mt-1 text-3xl font-semibold"><Money pence={totalMonthly} /></div>
          <p className="mt-2 text-sm text-muted">Average across tracked categories, excluding transfers between your own accounts.</p>
        </Card>

        {savings.depositsPerMonth > 0 && (
          <Card>
            <div className="text-sm text-muted">Net savings behaviour</div>
            <div className="mt-1 text-3xl font-semibold"><Money pence={savings.netPerMonth} />/mo</div>
            <p className="mt-2 text-sm text-muted">
              You transfer about <Money pence={savings.depositsPerMonth} /> into savings each month, but withdraw about{' '}
              <Money pence={savings.withdrawalsPerMonth} /> back out — so your typical <em>net</em> saving is closer to{' '}
              <Money pence={savings.netPerMonth} />.
            </p>
          </Card>
        )}
      </div>

      {signals.length > 0 && (
        <>
          <h2 className="mt-10 mb-3 font-semibold">Detected patterns</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {signals.map((s) => (
              <Card key={s.id}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{s.label}</span>
                  <Badge tone={CONF_TONE[s.confidence]}>{CONF_LABEL[s.confidence]}</Badge>
                </div>
                <div className="mt-2 text-2xl font-semibold tnum">
                  {s.unit === 'MULTIPLIER' ? `${s.value.toFixed(2)}×` : `${s.value}%`}
                </div>
                <p className="mt-1 text-sm text-muted">{s.detail}</p>
              </Card>
            ))}
          </div>
        </>
      )}

      <h2 className="mt-10 mb-3 font-semibold">By category</h2>
      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs text-muted">
            <tr>
              <th className="px-5 py-2.5 font-medium">Category</th>
              <th className="px-3 py-2.5 font-medium">Baseline / mo</th>
              <th className="hidden px-3 py-2.5 font-medium sm:table-cell">Likely range</th>
              <th className="hidden px-3 py-2.5 font-medium md:table-cell">Trend</th>
              <th className="hidden px-3 py-2.5 font-medium lg:table-cell">Last 12 mo</th>
              <th className="px-5 py-2.5 text-right font-medium">Confidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {stats.map((s) => (
              <tr key={s.categoryId}>
                <td className="px-5 py-3">{labels.get(s.categoryId) ?? 'Uncategorised'}</td>
                <td className="px-3 py-3 font-medium"><Money pence={s.expectedMonthlySpend} /></td>
                <td className="hidden px-3 py-3 text-muted sm:table-cell">
                  <Money pence={s.likelyRange[0]} />–<Money pence={s.likelyRange[1]} />
                </td>
                <td className="hidden px-3 py-3 text-muted md:table-cell">
                  {TREND[s.trend]}
                  {s.seasonalityStrength >= 0.3 && s.peakMonth && <span className="ml-2 text-xs text-accent">seasonal · peaks {s.peakMonth}</span>}
                </td>
                <td className="hidden w-32 px-3 py-3 lg:table-cell"><Sparkline values={s.monthlyTotals} /></td>
                <td className="px-5 py-3 text-right"><Badge tone={CONF_TONE[s.confidence]}>{CONF_LABEL[s.confidence]}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

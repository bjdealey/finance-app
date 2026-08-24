import Link from 'next/link';
import { requireUser } from '@/server/auth/session';
import { getAnalysis } from '@/server/services/analysis';
import { Card, Money, Badge, ProgressBar, PageHeader } from '@/components/ui';
import { RecommendationCard } from '@/components/recommendation-card';

export default async function DashboardPage() {
  const user = await requireUser();
  const a = await getAnalysis(user.id);
  const s = a.state;
  const accountName = new Map(a.snapshot.accounts.map((acc) => [acc.id, acc.name]));

  const totalAssets = s.currentAccountCash + s.savingsCash + s.investmentValue;
  const netSavingsFlow = s.savingsFlowIn - s.savingsFlowOut;
  const thisMonthSurplus = s.monthlyIncome - s.expectedMonthlySpend - netSavingsFlow;
  const runwayMonths = s.essentialMonthlySpend > 0 ? s.liquidCash / s.essentialMonthlySpend : 0;
  const topRecs = a.recommendations.filter((r) => r.type !== 'KEEP_BUFFER').slice(0, 3);

  return (
    <div className="space-y-10">
      <PageHeader title={`Good to see you, ${user.name.split(' ')[0]}`} subtitle="Here's where you stand — and what your money should do next." />

      {/* 1. What do I have? */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">What you have</h2>
        <Card>
          <div className="text-sm text-muted">Total across accounts</div>
          <div className="mt-1 text-4xl font-semibold"><Money pence={totalAssets} /></div>
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Tile label="Current accounts" value={s.currentAccountCash} hint="everyday & buffer" />
            <Tile label="Savings & ISA" value={s.savingsCash} hint="incl. Cash ISA" />
            <Tile label="Investments" value={s.investmentValue} hint="long-term" />
            <Tile label="Debt" value={-(s.creditCardDebt + s.otherDebt)} hint="cards & loans" negativeTone />
          </div>
          <p className="mt-4 text-xs text-muted">
            <Money pence={s.liquidCash} /> is available instantly · {runwayMonths.toFixed(1)} months of essential spending in cash
          </p>
        </Card>
      </section>

      {/* 2. What is happening this month? */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">This month</h2>
        <Card>
          <div className="grid gap-4 sm:grid-cols-4">
            <Flow label="Income" value={s.monthlyIncome} />
            <Flow label="Expected spending" value={-s.expectedMonthlySpend} />
            <Flow label="Into savings & investments" value={-netSavingsFlow} />
            <div>
              <div className="text-sm text-muted">Expected surplus</div>
              <div className="mt-1 text-2xl font-semibold"><Money pence={thisMonthSurplus} colored /></div>
            </div>
          </div>
        </Card>
      </section>

      {/* 3. What should I do? */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">What you should do</h2>
          <Link href="/recommendations" className="text-sm text-primary hover:underline">All recommendations →</Link>
        </div>
        {topRecs.length === 0 ? (
          <Card><p className="text-sm text-muted">Nothing to act on — your money is well placed.</p></Card>
        ) : (
          <div className="space-y-4">
            {topRecs.map((rec) => <RecommendationCard key={rec.id} rec={rec} accountName={accountName} />)}
          </div>
        )}
      </section>

      {/* 4. Am I on track? */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Are you on track?</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-medium">Goals</span>
              <Link href="/recommendations" className="text-xs text-muted">manage</Link>
            </div>
            <div className="space-y-4">
              {a.goals.map((g) => (
                <div key={g.goal.id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span>{g.goal.name}</span>
                    <span className="text-muted"><Money pence={g.currentAmount} /> / <Money pence={g.goal.targetAmount} /></span>
                  </div>
                  <ProgressBar pct={g.progressPct} tone={g.onTrack === false ? 'warn' : 'pos'} />
                  <div className="mt-1 flex items-center justify-between text-xs text-muted">
                    <span>{g.progressPct}%</span>
                    {g.onTrack === false ? <Badge tone="warn">behind</Badge> : g.onTrack ? <Badge tone="pos">on track</Badge> : <span>no target date</span>}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <span className="text-sm font-medium">Trajectory</span>
            <dl className="mt-4 space-y-3 text-sm">
              <Row label="Effective savings rate"><span className="font-medium">{s.effectiveSavingsRate}%</span></Row>
              <Row label="Net savings rate"><span className="font-medium">{s.netSavingsRate}%</span></Row>
              <Row label="Cash runway"><span className="font-medium">{runwayMonths.toFixed(1)} months</span></Row>
              <Row label="Projected in 12 months"><Money pence={a.forecasts[365].projectedBalance} className="font-medium" /></Row>
              <Row label="Emergency fund"><span className="font-medium"><Money pence={a.liquidity.emergencyFundCurrent} /> / <Money pence={a.liquidity.emergencyFundTarget} /></span></Row>
              <Row label="ISA allowance left"><span className="font-medium"><Money pence={a.isa.remaining} /> of <Money pence={a.isa.annualAllowance} /></span></Row>
            </dl>
          </Card>
        </div>
      </section>
    </div>
  );
}

function Tile({ label, value, hint, negativeTone }: { label: string; value: number; hint?: string; negativeTone?: boolean }) {
  return (
    <div>
      <div className="text-sm text-muted">{label}</div>
      <div className={`mt-0.5 text-xl font-semibold ${negativeTone && value < 0 ? 'text-neg' : ''}`}><Money pence={value} /></div>
      {hint && <div className="text-xs text-muted">{hint}</div>}
    </div>
  );
}

function Flow({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold"><Money pence={value} colored signed /></div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

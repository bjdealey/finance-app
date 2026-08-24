import { requireUser } from '@/server/auth/session';
import { getAnalysis } from '@/server/services/analysis';
import { debtSummary } from '@/core/debt';
import { Card, Money, Badge, PageHeader } from '@/components/ui';

export default async function HealthPage() {
  const user = await requireUser();
  const a = await getAnalysis(user.id);
  const s = a.state;

  // Annual interest currently earned vs cost of debt.
  const annualSavingsInterest = a.snapshot.accounts.reduce((sum, acc) => {
    const b = a.balances.find((x) => x.accountId === acc.id)?.balance ?? 0;
    return b > 0 ? sum + Math.round((b * acc.interestRateBps) / 10000) : sum;
  }, 0);
  const annualDebtCost = a.snapshot.accounts.reduce((sum, acc) => {
    const b = a.balances.find((x) => x.accountId === acc.id)?.balance ?? 0;
    return b < 0 ? sum + Math.round((-b * acc.interestRateBps) / 10000) : sum;
  }, 0);
  const bestRate = Math.max(0, ...a.snapshot.accounts.filter((acc) => ['SAVINGS', 'CASH_ISA'].includes(acc.accountType) && ['INSTANT', 'NOTICE'].includes(acc.accessType)).map((acc) => acc.interestRateBps));
  const potentialExtra = a.recommendations.filter((r) => r.type === 'MOVE_CASH').reduce((sum, r) => sum + (r.expectedBenefit?.annualInterestPence ?? 0), 0);
  const goalsBehind = a.goals.filter((g) => g.onTrack === false).length;
  const runway = s.essentialMonthlySpend > 0 ? s.liquidCash / s.essentialMonthlySpend : 0;
  const debts = debtSummary(a.snapshot);

  return (
    <div>
      <PageHeader title="Financial health" subtitle="A decomposable view — every figure traces back to your accounts and transactions. No black-box score." />

      <div className="grid gap-6 md:grid-cols-2">
        <Section title="Cash position" explanation="How your money is split across access levels.">
          <Metric label="Total cash" value={s.totalCash} />
          <Metric label="Instantly available" value={s.liquidCash} />
          <Metric label="In current accounts" value={s.currentAccountCash} />
          <Metric label="In savings & ISAs" value={s.savingsCash} />
          <Metric label="Invested (long-term)" value={s.investmentValue} />
        </Section>

        <Section title="Cash by purpose" explanation="Not all money is interchangeable — everything you hold, grouped by what it's actually for.">
          <Metric label="Emergency reserve" value={a.liquidity.buckets.emergencyReserve} />
          <Metric label="Near-term spending buffer" value={a.liquidity.buckets.nearTermBuffer} />
          <Metric label="Discretionary (spare)" value={a.liquidity.buckets.discretionaryCash} />
          <Metric label="Long-term / locked" value={a.liquidity.buckets.longTermCapital} />
        </Section>

        <Section title="Income & spending" explanation="Averaged from your last 12 months.">
          <Metric label="Monthly income" value={s.monthlyIncome} />
          <Metric label="Essential spending" value={s.essentialMonthlySpend} />
          <Metric label="Discretionary spending" value={s.discretionaryMonthlySpend} />
          <Metric label="Total expected spend" value={s.expectedMonthlySpend} />
          <Metric label="Monthly commitments (recurring)" value={s.monthlyCommitments} />
        </Section>

        <Section title="Savings behaviour" explanation="Gross is what you move in; net subtracts withdrawals; effective is income minus all spending.">
          <Metric label="Into savings / month" value={s.savingsFlowIn} />
          <Metric label="Out of savings / month" value={s.savingsFlowOut} />
          <TextMetric label="Gross savings rate" value={`${s.grossSavingsRate}%`} />
          <TextMetric label="Net savings rate" value={`${s.netSavingsRate}%`} />
          <TextMetric label="Effective savings rate" value={`${s.effectiveSavingsRate}%`} />
        </Section>

        <Section title="Debt" explanation="What you owe, what it costs, and how long it clears at your current payment.">
          <Metric label="Credit card debt" value={s.creditCardDebt} />
          <Metric label="Other debt" value={s.otherDebt} />
          <Metric label="Interest cost / year" value={annualDebtCost} />
          {debts.length === 0 ? (
            <p className="pt-1 text-xs text-muted">No debt — nothing to clear.</p>
          ) : (
            <div className="mt-2 space-y-2.5">
              {debts.map((d) => (
                <div key={d.accountId} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{d.name}</span>
                    <Money pence={d.balance} className="font-medium text-neg" />
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    {(d.aprBps / 100).toFixed(2)}% APR{d.utilisationPct != null && <> · {d.utilisationPct}% of limit used</>}
                  </div>
                  {d.payoff && d.monthlyPayment != null && (
                    d.payoff.clears ? (
                      <p className="mt-1.5 text-xs text-muted">
                        At <Money pence={d.monthlyPayment} />/mo it clears in {payoffTime(d.payoff.monthsToClear!)}, costing <Money pence={d.payoff.totalInterest!} /> in interest.
                      </p>
                    ) : (
                      <p className="mt-1.5 text-xs text-warn">
                        At the <Money pence={d.monthlyPayment} />/mo minimum this never clears — interest alone is <Money pence={d.payoff.monthlyInterest} />/mo. Paying more is the only way to make progress.
                      </p>
                    )
                  )}
                </div>
              ))}
            </div>
          )}
          {annualDebtCost > 0 && <p className="pt-1 text-xs text-warn">High-cost debt is your best return — clearing it beats any savings rate.</p>}
        </Section>

        <Section title="Emergency & runway" explanation="Your safety margin if income stopped.">
          <Metric label="Emergency fund" value={a.liquidity.emergencyFundCurrent} />
          <Metric label="Emergency target" value={a.liquidity.emergencyFundTarget} />
          <TextMetric label="Cash runway" value={`${runway.toFixed(1)} months`} />
          {a.liquidity.emergencyFundGap > 0 && <p className="pt-1 text-xs text-warn">About <Money pence={a.liquidity.emergencyFundGap} /> below target.</p>}
        </Section>

        <Section title="Account efficiency" explanation="Whether your cash is working as hard as it could.">
          <Metric label="Interest earned / year" value={annualSavingsInterest} />
          <Metric label="Idle current-account surplus" value={a.liquidity.surplusCash} />
          <TextMetric label="Best accessible rate" value={`${(bestRate / 100).toFixed(2)}%`} />
          {potentialExtra > 0 && (
            <p className="pt-1 text-xs text-muted">Acting on the recommendations could earn about <Money pence={potentialExtra} /> more interest a year.</p>
          )}
        </Section>

        <Section title="Goals" explanation="Progress toward what you're saving for.">
          {a.goals.map((g) => (
            <div key={g.goal.id} className="flex items-center justify-between text-sm">
              <span>{g.goal.name}</span>
              <span className="flex items-center gap-2 text-muted">
                {g.progressPct}%
                {g.onTrack === false ? <Badge tone="warn">behind</Badge> : g.onTrack ? <Badge tone="pos">on track</Badge> : null}
              </span>
            </div>
          ))}
          {goalsBehind > 0 && <p className="pt-1 text-xs text-warn">{goalsBehind} goal(s) behind target pace.</p>}
        </Section>

        <Section title="Forecast" explanation="Where your current-account cash is heading.">
          <Metric label="In 30 days" value={a.forecasts[30].projectedBalance} />
          <Metric label="In 90 days" value={a.forecasts[90].projectedBalance} />
          <Metric label="In 12 months" value={a.forecasts[365].projectedBalance} />
        </Section>
      </div>
    </div>
  );
}

function payoffTime(months: number): string {
  if (months < 24) return `${months} month${months === 1 ? '' : 's'}`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m ? `${y}y ${m}m` : `${y} years`;
}

function Section({ title, explanation, children }: { title: string; explanation: string; children: React.ReactNode }) {
  return (
    <Card>
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-0.5 mb-3 text-xs text-muted">{explanation}</p>
      <div className="space-y-1.5">{children}</div>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <Money pence={value} className="font-medium" />
    </div>
  );
}

function TextMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-medium tnum">{value}</span>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import type { ScenarioDelta, ScenarioResult } from '@/core/scenario';
import { runScenarioAction } from '@/app/(app)/scenarios/actions';
import { poundsToPence } from '@/core/money';
import { Card, Money, Badge } from '@/components/ui';

const RISK_LABEL: Record<string, string> = {
  NEGATIVE_MONTHLY_SURPLUS: 'Spends more than it earns each month',
  LOW_SAVINGS_RATE: 'Savings rate drops below 10%',
  RUNWAY_UNDER_3_MONTHS: 'Cash runway under 3 months',
  FORECAST_DIPS_NEGATIVE: 'Balance would go negative within a year',
  DIPS_INTO_SAVINGS: 'Would dip into savings',
  EXCEEDS_AVAILABLE_CASH: 'Exceeds available cash',
};

// null months = no positive contribution, so the goal isn't reached on the current pace.
const fmtMonths = (m: number | null) => (m == null ? 'not on this pace' : `${m} mo`);

type Fields = { income: number; spend: number; savings: number; oneOff: number };
const ZERO: Fields = { income: 0, spend: 0, savings: 0, oneOff: 0 };

const PRESETS: { label: string; fields: Fields }[] = [
  { label: 'Salary +£500/mo', fields: { ...ZERO, income: 500 } },
  { label: 'Cut eating out £60/mo', fields: { ...ZERO, spend: -60 } },
  { label: 'Save £300 more/mo', fields: { ...ZERO, savings: 300 } },
  { label: 'Rent +£400/mo', fields: { ...ZERO, spend: 400 } },
  { label: '£4,000 holiday', fields: { ...ZERO, oneOff: 4000 } },
];

function toDeltas(f: Fields): ScenarioDelta[] {
  const d: ScenarioDelta[] = [];
  if (f.income) d.push({ kind: 'INCOME', monthly: poundsToPence(f.income) });
  if (f.spend) d.push({ kind: 'SPEND', monthly: poundsToPence(f.spend) });
  if (f.savings) d.push({ kind: 'SAVINGS', monthly: poundsToPence(f.savings) });
  if (f.oneOff) d.push({ kind: 'ONE_OFF', amount: poundsToPence(f.oneOff) });
  return d;
}

export function ScenarioLab({ initial }: { initial: ScenarioResult }) {
  const [fields, setFields] = useState<Fields>(ZERO);
  const [result, setResult] = useState<ScenarioResult>(initial);
  const [pending, start] = useTransition();
  const runId = useRef(0);

  // Recompute as the numbers move — but wait for a pause in typing so it's one round-trip
  // per idea, not one per keystroke. Zero deltas *is* the baseline we were handed, so restore
  // it locally: mount and Reset stay instant with no server call. runId guards against a slow
  // response landing after a newer one (a stale scenario flashing in).
  useEffect(() => {
    const deltas = toDeltas(fields);
    if (deltas.length === 0) {
      runId.current++;
      setResult(initial);
      return;
    }
    const t = setTimeout(() => {
      const id = ++runId.current;
      start(async () => {
        const next = await runScenarioAction(deltas);
        if (id === runId.current) setResult(next);
      });
    }, 300);
    return () => clearTimeout(t);
  }, [fields, initial]);

  const b = result.baseline;
  const s = result.scenario;

  return (
    <div className="space-y-6">
      <Card>
        <div className="mb-4 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => setFields(p.fields)}
              className="rounded-full border border-border px-3 py-1.5 text-sm hover:bg-surface-2"
            >
              {p.label}
            </button>
          ))}
          <button onClick={() => setFields(ZERO)} className="rounded-full px-3 py-1.5 text-sm text-muted hover:text-fg">
            Reset
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <NumField label="Income ± /mo" value={fields.income} onChange={(v) => setFields((f) => ({ ...f, income: v }))} />
          <NumField label="Spending ± /mo" value={fields.spend} onChange={(v) => setFields((f) => ({ ...f, spend: v }))} />
          <NumField label="Into savings ± /mo" value={fields.savings} onChange={(v) => setFields((f) => ({ ...f, savings: v }))} />
          <NumField label="One-off cost" value={fields.oneOff} onChange={(v) => setFields((f) => ({ ...f, oneOff: v }))} />
        </div>
      </Card>

      <Card className={pending ? 'opacity-60 transition' : 'transition'}>
        <div className="-mx-5 overflow-x-auto px-5">
        <table className="w-full min-w-[26rem] text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="pb-2 font-medium">Metric</th>
              <th className="pb-2 text-right font-medium">Now</th>
              <th className="pb-2 text-right font-medium">Scenario</th>
              <th className="pb-2 text-right font-medium">Change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <MoneyRow label="Monthly income" now={b.monthlyIncome} next={s.monthlyIncome} />
            <MoneyRow label="Monthly spending" now={b.monthlySpend} next={s.monthlySpend} invert />
            <MoneyRow label="Into savings / mo" now={b.monthlySavings} next={s.monthlySavings} />
            <MoneyRow label="Monthly surplus" now={b.monthlySurplus} next={s.monthlySurplus} />
            <PctRow label="Savings rate" now={b.savingsRate} next={s.savingsRate} />
            <MoneyRow label="Projected annual surplus" now={b.annualSurplus} next={s.annualSurplus} />
            <MoneyRow label="Projected balance in 1 year" now={result.cashflowImpact.baselineProjectedBalance} next={result.cashflowImpact.scenarioProjectedBalance} />
            <Row label="Cash runway">
              <td className="py-2.5 text-right tnum">{b.runwayMonths.toFixed(1)} mo</td>
              <td className="py-2.5 text-right tnum">{s.runwayMonths.toFixed(1)} mo</td>
              <td className="py-2.5 text-right tnum text-muted">{(s.runwayMonths - b.runwayMonths).toFixed(1)}</td>
            </Row>
          </tbody>
        </table>
        </div>

        {result.riskFlags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {result.riskFlags.map((r) => (
              <Badge key={r} tone="warn" className="pop-in">{RISK_LABEL[r] ?? r}</Badge>
            ))}
          </div>
        )}
      </Card>

      {result.goalImpact.length > 0 && (
        <Card>
          <h3 className="mb-3 font-medium">Goal impact</h3>
          <ul className="space-y-2 text-sm">
            {result.goalImpact.map((g) => (
              <li key={g.goalId} className="flex items-center justify-between">
                <span>{g.name}</span>
                <span className="text-muted">
                  {fmtMonths(g.baselineMonths)} → <span className={g.scenarioMonths != null && g.baselineMonths != null && g.scenarioMonths < g.baselineMonths ? 'text-pos' : ''}>{fmtMonths(g.scenarioMonths)}</span> to reach
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      <div className="flex items-center rounded-lg border border-border bg-bg px-2 focus-within:border-primary">
        <span className="text-muted">£</span>
        <input
          type="number"
          value={value === 0 ? '' : value}
          placeholder="0"
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="w-full bg-transparent px-1 py-2 text-sm outline-none tnum"
        />
      </div>
    </label>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr>
      <td className="py-2.5">{label}</td>
      {children}
    </tr>
  );
}

function MoneyRow({ label, now, next, invert }: { label: string; now: number; next: number; invert?: boolean }) {
  const diff = next - now;
  const good = invert ? diff < 0 : diff > 0;
  return (
    <Row label={label}>
      <td className="py-2.5 text-right"><Money pence={now} /></td>
      <td className="py-2.5 text-right font-medium"><Money pence={next} /></td>
      <td className={`py-2.5 text-right ${diff === 0 ? 'text-muted' : good ? 'text-pos' : 'text-neg'}`}>
        {diff === 0 ? '—' : <Money pence={diff} signed />}
      </td>
    </Row>
  );
}

function PctRow({ label, now, next }: { label: string; now: number; next: number }) {
  const diff = next - now;
  return (
    <Row label={label}>
      <td className="py-2.5 text-right tnum">{now}%</td>
      <td className="py-2.5 text-right font-medium tnum">{next}%</td>
      <td className={`py-2.5 text-right tnum ${diff === 0 ? 'text-muted' : diff > 0 ? 'text-pos' : 'text-neg'}`}>
        {diff === 0 ? '—' : `${diff > 0 ? '+' : ''}${diff}%`}
      </td>
    </Row>
  );
}

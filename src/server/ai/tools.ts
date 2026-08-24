import type Anthropic from '@anthropic-ai/sdk';
import type { Analysis } from '@/core/analyse';
import { runScenario, type ScenarioDelta } from '@/core/scenario';
import { poundsToPence, formatGBP } from '@/core/money';
import { categoryLabels } from '@/lib/categories';

// Tool schemas the LLM sees. Every tool is read-only and returns values PRE-FORMATTED in GBP so the
// model quotes them verbatim and never does arithmetic (spec §32).
export const TOOLS: Anthropic.Tool[] = [
  { name: 'get_financial_state', description: "The user's current cash position, income, spending split and savings rates.", input_schema: { type: 'object', properties: {} } },
  {
    name: 'get_cashflow_forecast',
    description: 'Deterministic cash-flow forecast for the current accounts over a horizon.',
    input_schema: { type: 'object', properties: { horizon_days: { type: 'number', enum: [7, 30, 90, 365], description: 'Forecast horizon' } }, required: ['horizon_days'] },
  },
  { name: 'get_spending_analysis', description: 'Behavioural spending baselines per category, savings behaviour, and detected signals.', input_schema: { type: 'object', properties: {} } },
  { name: 'get_account_comparison', description: 'All accounts with balances, interest rates and access type.', input_schema: { type: 'object', properties: {} } },
  { name: 'get_goal_status', description: 'Progress toward each financial goal and whether it is on track.', input_schema: { type: 'object', properties: {} } },
  { name: 'get_recommendations', description: 'The current deterministic recommendations with their headline reasons.', input_schema: { type: 'object', properties: {} } },
  {
    name: 'explain_recommendation',
    description: 'Full explanation trace (what / why / why this account / what if ignored) for one recommendation by its index from get_recommendations.',
    input_schema: { type: 'object', properties: { index: { type: 'number' } }, required: ['index'] },
  },
  {
    name: 'run_scenario',
    description: 'Model a what-if without changing anything. All amounts are in pounds; positive spend/one-off means more money out.',
    input_schema: {
      type: 'object',
      properties: {
        income_change_monthly: { type: 'number', description: 'Change to monthly income, £' },
        spend_change_monthly: { type: 'number', description: 'Change to monthly spending, £' },
        savings_change_monthly: { type: 'number', description: 'Change to monthly amount moved into savings, £' },
        one_off_cost: { type: 'number', description: 'One-time cost, £' },
      },
    },
  },
];

export function runTool(name: string, input: Record<string, unknown>, a: Analysis): unknown {
  const s = a.state;
  const labels = categoryLabels(a.snapshot.categories);
  const accountName = new Map(a.snapshot.accounts.map((acc) => [acc.id, acc.name]));

  switch (name) {
    case 'get_financial_state':
      return {
        totalCash: formatGBP(s.totalCash),
        instantlyAvailable: formatGBP(s.liquidCash),
        currentAccounts: formatGBP(s.currentAccountCash),
        savingsAndIsa: formatGBP(s.savingsCash),
        investments: formatGBP(s.investmentValue),
        creditCardDebt: formatGBP(s.creditCardDebt),
        monthlyIncome: formatGBP(s.monthlyIncome),
        essentialSpend: formatGBP(s.essentialMonthlySpend),
        discretionarySpend: formatGBP(s.discretionaryMonthlySpend),
        expectedMonthlySpend: formatGBP(s.expectedMonthlySpend),
        grossSavingsRate: `${s.grossSavingsRate}%`,
        netSavingsRate: `${s.netSavingsRate}%`,
        effectiveSavingsRate: `${s.effectiveSavingsRate}%`,
        isaAllowanceUsedThisTaxYear: formatGBP(a.isa.used),
        isaAllowanceRemaining: formatGBP(a.isa.remaining),
        isaAllowanceTotal: formatGBP(a.isa.annualAllowance),
      };

    case 'get_cashflow_forecast': {
      const h = (input.horizon_days as number) ?? 30;
      const f = a.forecasts[h] ?? a.forecasts[30];
      return {
        horizonDays: f.horizonDays,
        openingBalance: formatGBP(f.openingBalance),
        projectedBalance: formatGBP(f.projectedBalance),
        confidenceRange: `${formatGBP(f.low)} to ${formatGBP(f.high)}`,
        keyItems: f.items.filter((i) => i.amount !== 0).slice(0, 12).map((i) => ({ date: i.date, label: i.label, amount: formatGBP(i.amount), source: i.source })),
      };
    }

    case 'get_spending_analysis':
      return {
        totalMonthlySpend: formatGBP(a.categoryStats.reduce((sum, c) => sum + c.monthlyAverage, 0)),
        topCategories: a.categoryStats.filter((c) => c.monthlyAverage > 0).slice(0, 8).map((c) => ({
          category: labels.get(c.categoryId) ?? 'Uncategorised',
          baseline: formatGBP(c.expectedMonthlySpend),
          likelyRange: `${formatGBP(c.likelyRange[0])}–${formatGBP(c.likelyRange[1])}`,
          trend: c.trend,
          confidence: c.confidence,
        })),
        savingsBehaviour: {
          intoSavingsPerMonth: formatGBP(a.savings.depositsPerMonth),
          outOfSavingsPerMonth: formatGBP(a.savings.withdrawalsPerMonth),
          netPerMonth: formatGBP(a.savings.netPerMonth),
          withdrawalRate: `${a.savings.withdrawalRatePct}%`,
        },
        signals: a.signals.map((sig) => ({ label: sig.label, value: sig.unit === 'PERCENT' ? `${sig.value}%` : `${sig.value}×`, detail: sig.detail, confidence: sig.confidence })),
      };

    case 'get_account_comparison':
      return {
        accounts: a.snapshot.accounts.map((acc) => ({
          name: acc.name,
          type: acc.accountType,
          balance: formatGBP(a.balances.find((b) => b.accountId === acc.id)?.balance ?? 0),
          rate: acc.interestRateBps > 0 ? `${(acc.interestRateBps / 100).toFixed(2)}%` : 'none',
          access: acc.accessType,
        })),
      };

    case 'get_goal_status':
      return {
        goals: a.goals.map((g) => ({
          name: g.goal.name,
          current: formatGBP(g.currentAmount),
          target: formatGBP(g.goal.targetAmount),
          progress: `${g.progressPct}%`,
          requiredMonthly: g.requiredMonthly != null ? formatGBP(g.requiredMonthly) : null,
          recentMonthly: formatGBP(g.recentMonthly),
          onTrack: g.onTrack,
        })),
      };

    case 'get_recommendations':
      return {
        surplusIdentified: formatGBP(a.liquidity.surplusCash),
        recommendations: a.recommendations.map((r, index) => ({
          index,
          type: r.type,
          what: r.explanation.what,
          why: r.explanation.why,
          confidence: r.confidence,
        })),
      };

    case 'explain_recommendation': {
      const rec = a.recommendations[input.index as number];
      if (!rec) return { error: 'No recommendation at that index.' };
      return {
        what: rec.explanation.what,
        why: rec.explanation.why,
        whyThisAccount: rec.explanation.whyThisAccount ?? null,
        whatIfIgnored: rec.explanation.whatIfIgnored ?? null,
        confidence: rec.explanation.confidence,
        from: rec.sourceAccountId ? accountName.get(rec.sourceAccountId) : null,
        to: rec.destinationAccountId ? accountName.get(rec.destinationAccountId) : null,
        reasonCodes: rec.reasonCodes,
        constraintsChecked: rec.constraintsChecked,
      };
    }

    case 'run_scenario': {
      const deltas: ScenarioDelta[] = [];
      if (input.income_change_monthly) deltas.push({ kind: 'INCOME', monthly: poundsToPence(input.income_change_monthly as number) });
      if (input.spend_change_monthly) deltas.push({ kind: 'SPEND', monthly: poundsToPence(input.spend_change_monthly as number) });
      if (input.savings_change_monthly) deltas.push({ kind: 'SAVINGS', monthly: poundsToPence(input.savings_change_monthly as number) });
      if (input.one_off_cost) deltas.push({ kind: 'ONE_OFF', amount: poundsToPence(input.one_off_cost as number) });
      const r = runScenario(a.snapshot, deltas);
      const fmt = (m: typeof r.baseline) => ({ monthlyIncome: formatGBP(m.monthlyIncome), monthlySpend: formatGBP(m.monthlySpend), monthlySurplus: formatGBP(m.monthlySurplus), savingsRate: `${m.savingsRate}%`, annualSurplus: formatGBP(m.annualSurplus), runwayMonths: m.runwayMonths.toFixed(1) });
      return {
        baseline: fmt(r.baseline),
        scenario: fmt(r.scenario),
        change: { monthlySurplus: formatGBP(r.difference.monthlySurplus), savingsRate: `${r.difference.savingsRate}%`, annualSurplus: formatGBP(r.difference.annualSurplus) },
        riskFlags: r.riskFlags,
      };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

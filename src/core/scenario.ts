import type { FinancialSnapshot } from './types';
import { computeFinancialState } from './state';
import { goalStatuses } from './goals';

// A what-if is a set of deltas over the current position. It NEVER mutates the snapshot — it derives
// scenario metrics analytically from the baseline financial state (spec §21).
export type ScenarioDelta =
  | { kind: 'INCOME'; monthly: number } // +/- monthly income
  | { kind: 'SPEND'; monthly: number } // +/- monthly spending
  | { kind: 'SAVINGS'; monthly: number } // +/- monthly amount moved into savings
  | { kind: 'ONE_OFF'; amount: number }; // one-time cost (positive = money out)

export interface ScenarioMetrics {
  monthlyIncome: number;
  monthlySpend: number;
  monthlySavings: number;
  monthlySurplus: number; // income - spend - savings (what stays in the current account)
  savingsRate: number; // % (net savings / income)
  annualSurplus: number; // 12 * (income - spend)
  runwayMonths: number;
}

export interface GoalImpact {
  goalId: string;
  name: string;
  baselineMonths: number | null;
  scenarioMonths: number | null;
}

export interface ScenarioResult {
  baseline: ScenarioMetrics;
  scenario: ScenarioMetrics;
  difference: {
    monthlySurplus: number;
    savingsRate: number;
    annualSurplus: number;
    monthlySpend: number;
    monthlySavings: number;
  };
  goalImpact: GoalImpact[];
  riskFlags: string[];
}

function metrics(income: number, spend: number, savings: number, liquidCash: number, essential: number): ScenarioMetrics {
  return {
    monthlyIncome: income,
    monthlySpend: spend,
    monthlySavings: savings,
    monthlySurplus: income - spend - savings,
    savingsRate: income > 0 ? Math.round((savings / income) * 100) : 0,
    annualSurplus: 12 * (income - spend),
    runwayMonths: essential > 0 ? liquidCash / essential : 0,
  };
}

export function runScenario(snapshot: FinancialSnapshot, deltas: ScenarioDelta[]): ScenarioResult {
  const state = computeFinancialState(snapshot);
  const goals = goalStatuses(snapshot);

  const dIncome = deltas.filter((d) => d.kind === 'INCOME').reduce((s, d) => s + (d as { monthly: number }).monthly, 0);
  const dSpend = deltas.filter((d) => d.kind === 'SPEND').reduce((s, d) => s + (d as { monthly: number }).monthly, 0);
  const dSavings = deltas.filter((d) => d.kind === 'SAVINGS').reduce((s, d) => s + (d as { monthly: number }).monthly, 0);
  const oneOff = deltas.filter((d) => d.kind === 'ONE_OFF').reduce((s, d) => s + (d as { amount: number }).amount, 0);

  const baseIncome = state.monthlyIncome;
  const baseSpend = state.expectedMonthlySpend;
  const baseSavings = state.savingsFlowIn - state.savingsFlowOut;

  const baseline = metrics(baseIncome, baseSpend, baseSavings, state.liquidCash, state.essentialMonthlySpend);
  const scenario = metrics(
    baseIncome + dIncome,
    baseSpend + dSpend,
    baseSavings + dSavings,
    state.liquidCash - oneOff, // a one-off cost reduces available cash now
    state.essentialMonthlySpend,
  );

  // Goal impact: apply the savings delta to the highest-priority goal with a target date.
  const topGoalId = goals
    .filter((g) => g.goal.targetDate && g.onTrack !== true)
    .sort((a, b) => a.goal.priority - b.goal.priority)[0]?.goal.id;
  const goalImpact: GoalImpact[] = goals
    .filter((g) => g.requiredMonthly != null)
    .map((g) => {
      const remaining = Math.max(0, g.goal.targetAmount - g.currentAmount);
      const baseContribution = Math.max(1, g.recentMonthly);
      const scenContribution = Math.max(1, g.recentMonthly + (g.goal.id === topGoalId ? dSavings : 0));
      return {
        goalId: g.goal.id,
        name: g.goal.name,
        baselineMonths: Math.ceil(remaining / baseContribution),
        scenarioMonths: Math.ceil(remaining / scenContribution),
      };
    });

  const riskFlags: string[] = [];
  if (scenario.monthlySurplus < 0) riskFlags.push('NEGATIVE_MONTHLY_SURPLUS');
  if (scenario.savingsRate < 10) riskFlags.push('LOW_SAVINGS_RATE');
  if (scenario.runwayMonths < 3) riskFlags.push('RUNWAY_UNDER_3_MONTHS');
  if (oneOff > state.currentAccountCash) riskFlags.push('DIPS_INTO_SAVINGS');
  if (oneOff > state.liquidCash) riskFlags.push('EXCEEDS_AVAILABLE_CASH');

  return {
    baseline,
    scenario,
    difference: {
      monthlySurplus: scenario.monthlySurplus - baseline.monthlySurplus,
      savingsRate: scenario.savingsRate - baseline.savingsRate,
      annualSurplus: scenario.annualSurplus - baseline.annualSurplus,
      monthlySpend: scenario.monthlySpend - baseline.monthlySpend,
      monthlySavings: scenario.monthlySavings - baseline.monthlySavings,
    },
    goalImpact,
    riskFlags,
  };
}

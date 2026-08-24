import type { FinancialSnapshot } from './types';
import { computeFinancialState } from './state';
import { goalStatuses } from './goals';
import { forecast } from './forecast';
import { addMonthsISO, addDaysISO } from './dates';

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

// Spec §21 cashflow_impact: derived from a real forecast re-run, not analytic arithmetic.
export interface CashflowImpact {
  horizonDays: number; // 365
  baselineProjectedBalance: number; // the actual 12-month forecast on today's snapshot
  scenarioProjectedBalance: number; // that forecast plus the scenario's marginal flows
  scenarioTrough: number; // lowest running current-account balance along the scenario path
  scenarioGoesNegative: boolean; // the path dips below zero within the horizon
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
  cashflowImpact: CashflowImpact;
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
  // Months to clear `remaining` (pence) at a monthly contribution (pence). With no positive
  // contribution the goal isn't being funded, so time-to-reach is undefined (null) — NOT
  // remaining-pence divided by a 1p floor, which reported hundreds of thousands of months.
  const monthsToReach = (remaining: number, contribution: number): number | null =>
    contribution > 0 ? Math.ceil(remaining / contribution) : null;
  const goalImpact: GoalImpact[] = goals
    .filter((g) => g.requiredMonthly != null)
    .map((g) => {
      const remaining = Math.max(0, g.goal.targetAmount - g.currentAmount);
      const scenContribution = g.recentMonthly + (g.goal.id === topGoalId ? dSavings : 0);
      return {
        goalId: g.goal.id,
        name: g.goal.name,
        baselineMonths: monthsToReach(remaining, g.recentMonthly),
        scenarioMonths: monthsToReach(remaining, scenContribution),
      };
    });

  // Cash-flow impact (spec §21): re-run the real 12-month forecast for the baseline path, then layer
  // the scenario's marginal flows on top (monthly net delta + the one-off) and re-evaluate where the
  // balance lands and its lowest point. Anchored on the actual forecast engine, so it reflects current
  // balances, recurring bills, predicted spend and scheduled payments — not a 12×(income−spend) guess.
  const baseFc = forecast(snapshot, 365);
  const netMonthly = dIncome - dSpend - dSavings; // per-month effect on current-account cash
  const deltaItems: { date: string; amount: number }[] = [];
  if (netMonthly !== 0) for (let k = 1; k <= 12; k++) deltaItems.push({ date: addMonthsISO(snapshot.asOf, k), amount: netMonthly });
  if (oneOff !== 0) deltaItems.push({ date: addDaysISO(snapshot.asOf, 7), amount: -oneOff });
  const scenItems = [...baseFc.items.map((i) => ({ date: i.date, amount: i.amount })), ...deltaItems].sort((a, b) => a.date.localeCompare(b.date));
  let running = baseFc.openingBalance;
  let scenarioTrough = running;
  for (const it of scenItems) {
    running += it.amount;
    if (running < scenarioTrough) scenarioTrough = running;
  }
  const cashflowImpact: CashflowImpact = {
    horizonDays: 365,
    baselineProjectedBalance: baseFc.projectedBalance,
    scenarioProjectedBalance: baseFc.projectedBalance + deltaItems.reduce((s, i) => s + i.amount, 0),
    scenarioTrough,
    scenarioGoesNegative: scenarioTrough < 0,
  };

  const riskFlags: string[] = [];
  if (scenario.monthlySurplus < 0) riskFlags.push('NEGATIVE_MONTHLY_SURPLUS');
  if (scenario.savingsRate < 10) riskFlags.push('LOW_SAVINGS_RATE');
  if (scenario.runwayMonths < 3) riskFlags.push('RUNWAY_UNDER_3_MONTHS');
  if (cashflowImpact.scenarioGoesNegative) riskFlags.push('FORECAST_DIPS_NEGATIVE');
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
    cashflowImpact,
    riskFlags,
  };
}

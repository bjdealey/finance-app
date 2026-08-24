import type { FinancialSnapshot, ReasonCode, ConstraintCode, ExplanationTrace, ConfidenceTier } from './types';
import type { FinancialState } from './state';
import type { Liquidity } from './liquidity';
import type { OptimisationResult } from './optimise';
import type { GoalStatus } from './goals';
import type { CategoryStat } from './behaviour';
import { formatGBP } from './money';

export type RecType = 'MOVE_CASH' | 'PAY_DEBT' | 'KEEP_BUFFER' | 'REDUCE_SPEND' | 'GOAL_CONTRIBUTION';

export interface Recommendation {
  id: string;
  type: RecType;
  priority: number; // lower = more important
  sourceAccountId: string | null;
  destinationAccountId: string | null;
  amount: number | null;
  reasonCodes: ReasonCode[];
  constraintsChecked: ConstraintCode[];
  expectedBenefit: { annualInterestPence?: number; annualSavingPence?: number; aprAvoidedPence?: number } | null;
  confidence: number; // 0-100
  impact: Record<string, number> | null;
  explanation: ExplanationTrace;
}

export interface RecommendationInputs {
  snapshot: FinancialSnapshot;
  state: FinancialState;
  liquidity: Liquidity;
  optimisation: OptimisationResult;
  goals: GoalStatus[];
  categoryStats: CategoryStat[];
}

const ESSENTIAL = new Set(['rent', 'mortgage', 'council tax', 'utilities', 'water', 'broadband', 'groceries', 'insurance', 'debt payments', 'interest charged', 'public transport', 'mobile']);
const TIER_CONFIDENCE: Record<ConfidenceTier, number> = { HIGH: 85, MEDIUM: 70, LOW: 55, INSUFFICIENT_DATA: 0 };

export function buildRecommendations(inp: RecommendationInputs): Recommendation[] {
  const { snapshot, state, liquidity, optimisation, goals, categoryStats } = inp;
  const recs: Recommendation[] = [];
  const preferInstant = snapshot.userRules.some((r) => r.active && r.ruleType === 'PREFER_INSTANT_ACCESS');
  const src = optimisation.sourceAccountId;
  const srcName = optimisation.sourceName;

  for (const a of optimisation.allocations) {
    if (a.kind === 'PAY_DEBT') {
      const apr = (a.meta.aprBps ?? 0) / 100;
      const aprAvoided = Math.round((a.amount * (a.meta.aprBps ?? 0)) / 10000);
      recs.push({
        id: `PAY_DEBT:${src ?? ''}:${a.destinationAccountId}`,
        type: 'PAY_DEBT',
        priority: 10,
        sourceAccountId: src,
        destinationAccountId: a.destinationAccountId,
        amount: a.amount,
        reasonCodes: a.reasonCodes,
        constraintsChecked: a.constraintsChecked,
        expectedBenefit: { aprAvoidedPence: aprAvoided },
        confidence: 96,
        impact: { debtReduced: a.amount },
        explanation: {
          what: `Pay ${formatGBP(a.amount)} off ${a.destinationName} from ${srcName}.`,
          why: `${a.destinationName} charges ${apr.toFixed(1)}% APR — the most expensive money you hold. Clearing it is effectively a guaranteed ${apr.toFixed(1)}% return, better than any savings rate.`,
          whatIfIgnored: `Carrying this balance costs about ${formatGBP(aprAvoided)} in interest over the next year at the current rate.`,
          confidence: 'HIGH',
        },
      });
    } else if (a.kind === 'EMERGENCY_FUND') {
      recs.push({
        id: `MOVE_CASH:${src ?? ''}:${a.destinationAccountId}`,
        type: 'MOVE_CASH',
        priority: 20,
        sourceAccountId: src,
        destinationAccountId: a.destinationAccountId,
        amount: a.amount,
        reasonCodes: a.reasonCodes,
        constraintsChecked: a.constraintsChecked,
        expectedBenefit: { annualInterestPence: Math.round((a.amount * (a.meta.rateBps ?? 0)) / 10000) },
        confidence: 90,
        impact: { emergencyGapClosed: a.amount },
        explanation: {
          what: `Move ${formatGBP(a.amount)} to ${a.destinationName}.`,
          why: `Your emergency fund is about ${formatGBP(liquidity.emergencyFundGap)} below your safety target of ${formatGBP(liquidity.emergencyFundTarget)} (a few months of essential spending).`,
          whyThisAccount: `${a.destinationName} is your instant-access emergency reserve, so the money stays reachable.`,
          whatIfIgnored: `An unexpected cost could force you onto credit instead of your own reserve.`,
          confidence: 'HIGH',
        },
      });
    } else if (a.kind === 'SAVINGS') {
      const rate = (a.meta.rateBps ?? 0) / 100;
      const annualInterest = Math.round((a.amount * ((a.meta.rateBps ?? 0) - (a.meta.sourceRateBps ?? 0))) / 10000);
      recs.push({
        id: `MOVE_CASH:${src ?? ''}:${a.destinationAccountId}`,
        type: 'MOVE_CASH',
        priority: 30,
        sourceAccountId: src,
        destinationAccountId: a.destinationAccountId,
        amount: a.amount,
        reasonCodes: a.reasonCodes,
        constraintsChecked: a.constraintsChecked,
        expectedBenefit: { annualInterestPence: annualInterest },
        confidence: 88,
        impact: { moved: a.amount },
        explanation: {
          what: `Move ${formatGBP(a.amount)} from ${srcName} to ${a.destinationName}.`,
          why: `Even at the lowest point of your next 30 days, ${srcName} holds roughly ${formatGBP(optimisation.surplus)} more than you need for upcoming commitments and your buffer. That cash is sitting idle.`,
          whyThisAccount: `${a.destinationName} pays ${rate.toFixed(2)}% — the best accessible rate among your savings${preferInstant ? ', and it keeps instant access as your rules require' : ''}.`,
          whatIfIgnored: `Your money stays liquid but earns about ${formatGBP(annualInterest)} less over the next year, assuming rates hold.`,
          confidence: 'HIGH',
        },
      });
    } else if (a.kind === 'BUFFER') {
      recs.push({
        id: `KEEP_BUFFER:${a.destinationAccountId}`,
        type: 'KEEP_BUFFER',
        priority: 60,
        sourceAccountId: null,
        destinationAccountId: a.destinationAccountId,
        amount: a.amount,
        reasonCodes: a.reasonCodes,
        constraintsChecked: a.constraintsChecked,
        expectedBenefit: null,
        confidence: 80,
        impact: null,
        explanation: {
          what: `Keep ${formatGBP(a.amount)} available in ${a.destinationName}.`,
          why: `Held back as discretionary headroom for anything unexpected this month, on top of your required buffer.`,
          confidence: 'MEDIUM',
        },
      });
    }
  }

  // Goal-behind recommendations.
  for (const g of goals) {
    if (g.onTrack === false && g.requiredMonthly != null && g.requiredMonthly > g.recentMonthly) {
      const shortfall = g.requiredMonthly - g.recentMonthly;
      recs.push({
        id: `GOAL_CONTRIBUTION:${g.goal.id}`,
        type: 'GOAL_CONTRIBUTION',
        priority: 40,
        sourceAccountId: optimisation.sourceAccountId,
        destinationAccountId: g.goal.linkedAccountId,
        amount: shortfall,
        reasonCodes: ['GOAL_BEHIND_TARGET'],
        constraintsChecked: ['30_DAY_LIQUIDITY'],
        expectedBenefit: null,
        confidence: 75,
        impact: { monthlyShortfall: shortfall },
        explanation: {
          what: `Add about ${formatGBP(shortfall)}/month toward "${g.goal.name}".`,
          why: `You're contributing about ${formatGBP(g.recentMonthly)}/month, but need ${formatGBP(g.requiredMonthly)}/month to reach ${formatGBP(g.goal.targetAmount)}${g.goal.targetDate ? ` by ${g.goal.targetDate}` : ''}.`,
          confidence: 'MEDIUM',
        },
      });
    }
  }

  // One reduce-spend nudge for the biggest discretionary category (non-judgemental).
  const catName = new Map(snapshot.categories.map((c) => [c.id, c.name]));
  const discretionary = categoryStats
    .filter((s) => !ESSENTIAL.has((catName.get(s.categoryId) ?? '').toLowerCase()) && s.confidence !== 'INSUFFICIENT_DATA' && s.monthlyAverage >= 8000)
    .sort((a, b) => b.monthlyAverage - a.monthlyAverage)[0];
  if (discretionary) {
    const name = catName.get(discretionary.categoryId) ?? 'this category';
    const target = Math.max(discretionary.likelyRange[0], Math.round(discretionary.expectedMonthlySpend * 0.8));
    const reduction = discretionary.expectedMonthlySpend - target;
    if (reduction > 1000) {
      recs.push({
        id: `REDUCE_SPEND:${discretionary.categoryId}`,
        type: 'REDUCE_SPEND',
        priority: 50,
        sourceAccountId: null,
        destinationAccountId: null,
        amount: reduction,
        reasonCodes: ['BEHAVIOURAL_PATTERN'],
        constraintsChecked: [],
        expectedBenefit: { annualSavingPence: reduction * 12 },
        confidence: TIER_CONFIDENCE[discretionary.confidence],
        impact: { monthlyReduction: reduction },
        explanation: {
          what: `Consider trimming ${name} by about ${formatGBP(reduction)}/month.`,
          why: `Your recent average is ${formatGBP(discretionary.expectedMonthlySpend)}/month (typical range ${formatGBP(discretionary.likelyRange[0])}–${formatGBP(discretionary.likelyRange[1])}). Easing to about ${formatGBP(target)} would free up roughly ${formatGBP(reduction * 12)} a year — no judgement, just the maths.`,
          confidence: discretionary.confidence === 'HIGH' ? 'HIGH' : 'MEDIUM',
        },
      });
    }
  }

  return recs.sort((a, b) => a.priority - b.priority);
}

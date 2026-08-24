import type { FinancialSnapshot } from './types';
import { computeBalances, type AccountBalance } from './ledger';
import { computeFinancialState, type FinancialState } from './state';
import { forecast, type Forecast } from './forecast';
import { computeLiquidity, type Liquidity } from './liquidity';
import { optimize, type OptimisationResult } from './optimise';
import { goalStatuses, type GoalStatus } from './goals';
import { analyseCategories, analyseSavings, type CategoryStat, type SavingsBehaviour } from './behaviour';
import { computeSignals, type BehaviouralSignal } from './signals';
import { detectRecurring, type RecurringSeries } from './recurring';
import { buildRecommendations, type Recommendation } from './recommend';

export interface Analysis {
  snapshot: FinancialSnapshot;
  balances: AccountBalance[];
  state: FinancialState;
  forecasts: Record<number, Forecast>; // 7 / 30 / 90 / 365
  liquidity: Liquidity;
  optimisation: OptimisationResult;
  goals: GoalStatus[];
  categoryStats: CategoryStat[];
  savings: SavingsBehaviour;
  signals: BehaviouralSignal[];
  recurring: RecurringSeries[];
  recommendations: Recommendation[];
}

// The whole deterministic pipeline in one place. Pure — pages and the AI tool layer both call this
// so every number the user or the LLM sees comes from the same computation.
export function analyseFinances(snapshot: FinancialSnapshot): Analysis {
  const state = computeFinancialState(snapshot);
  const forecasts: Record<number, Forecast> = {
    7: forecast(snapshot, 7),
    30: forecast(snapshot, 30),
    90: forecast(snapshot, 90),
    365: forecast(snapshot, 365),
  };
  const liquidity = computeLiquidity(snapshot, state, forecasts[30]);
  const optimisation = optimize(snapshot, state, liquidity);
  const goals = goalStatuses(snapshot);
  const categoryStats = analyseCategories(snapshot);
  const recommendations = buildRecommendations({ snapshot, state, liquidity, optimisation, goals, categoryStats });

  return {
    snapshot,
    balances: computeBalances(snapshot),
    state,
    forecasts,
    liquidity,
    optimisation,
    goals,
    categoryStats,
    savings: analyseSavings(snapshot),
    signals: computeSignals(snapshot),
    recurring: detectRecurring(snapshot),
    recommendations,
  };
}

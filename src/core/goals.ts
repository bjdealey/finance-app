import type { FinancialSnapshot, Goal } from './types';
import { computeBalances } from './ledger';
import { daysBetween, addMonthsISO } from './dates';

export interface GoalStatus {
  goal: Goal;
  currentAmount: number;
  progressPct: number;
  monthsRemaining: number | null;
  requiredMonthly: number | null;
  recentMonthly: number; // recent actual contribution into the linked account
  onTrack: boolean | null;
}

// Net transfers into an account over the last `months`, per month.
function recentMonthlyInflow(snapshot: FinancialSnapshot, accountId: string, months = 3): number {
  const cutoff = addMonthsISO(snapshot.asOf, -months);
  let net = 0;
  for (const t of snapshot.transactions) {
    if (t.accountId === accountId && t.transactionType === 'TRANSFER' && t.date >= cutoff && t.date <= snapshot.asOf) {
      net += t.amount;
    }
  }
  return Math.round(net / months);
}

export function goalStatuses(snapshot: FinancialSnapshot): GoalStatus[] {
  const balances = new Map(computeBalances(snapshot).map((b) => [b.accountId, b.balance]));
  return snapshot.goals.map((goal) => {
    const currentAmount = goal.linkedAccountId ? balances.get(goal.linkedAccountId) ?? goal.currentAmount : goal.currentAmount;
    const progressPct = goal.targetAmount > 0 ? Math.round((currentAmount / goal.targetAmount) * 100) : 100;
    const recentMonthly = goal.linkedAccountId ? recentMonthlyInflow(snapshot, goal.linkedAccountId) : 0;

    let monthsRemaining: number | null = null;
    let requiredMonthly: number | null = null;
    let onTrack: boolean | null = null;
    const remaining = Math.max(0, goal.targetAmount - currentAmount);

    if (currentAmount >= goal.targetAmount) {
      onTrack = true;
    } else if (goal.targetDate) {
      monthsRemaining = Math.max(0, daysBetween(goal.targetDate, snapshot.asOf) / 30.4);
      requiredMonthly = monthsRemaining > 0 ? Math.round(remaining / monthsRemaining) : remaining;
      onTrack = recentMonthly >= requiredMonthly * 0.9;
    }
    return { goal, currentAmount, progressPct, monthsRemaining, requiredMonthly, recentMonthly, onTrack };
  });
}

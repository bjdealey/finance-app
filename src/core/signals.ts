import type { FinancialSnapshot, ConfidenceTier } from './types';
import { isSpend, analyseSavings } from './behaviour';
import { completeMonthsBefore, monthKey } from './dates';
import { median } from './stats';

export interface BehaviouralSignal {
  id: string;
  label: string;
  value: number;
  unit: 'MULTIPLIER' | 'PERCENT';
  confidence: ConfidenceTier;
  detail: string; // factual, non-judgemental
}

const isWeekend = (iso: string): boolean => {
  const d = new Date(iso + 'T00:00:00Z').getUTCDay();
  return d === 0 || d === 6;
};
const dom = (iso: string): number => +iso.slice(8, 10);

function tierFromCount(n: number): ConfidenceTier {
  if (n < 20) return 'INSUFFICIENT_DATA';
  if (n < 60) return 'LOW';
  if (n < 150) return 'MEDIUM';
  return 'HIGH';
}

// Data-driven behavioural signals with confidence tiers. Never asserts on insufficient data.
export function computeSignals(snapshot: FinancialSnapshot): BehaviouralSignal[] {
  const months = new Set(completeMonthsBefore(snapshot.asOf, 12));
  const spend = snapshot.transactions.filter((t) => isSpend(t) && months.has(monthKey(t.date)));
  const signals: BehaviouralSignal[] = [];

  // Weekend spending multiplier (2 weekend days vs 5 weekday days).
  {
    let we = 0;
    let wd = 0;
    for (const t of spend) (isWeekend(t.date) ? (we += Math.abs(t.amount)) : (wd += Math.abs(t.amount)));
    const multiplier = wd > 0 ? +((we / wd) * 2.5).toFixed(2) : 0;
    signals.push({
      id: 'weekend_spending_multiplier',
      label: 'Weekend spending',
      value: multiplier,
      unit: 'MULTIPLIER',
      confidence: tierFromCount(spend.length),
      detail: `You spend about ${multiplier.toFixed(2)}× as much per day at weekends as on weekdays.`,
    });
  }

  // Post-payday spending multiplier — days 0-5 after the typical payday vs the rest of the month.
  const incomeDays = snapshot.transactions
    .filter((t) => t.amount > 0 && t.transactionType === 'INCOME')
    .map((t) => dom(t.date));
  if (incomeDays.length >= 3 && spend.length >= 20) {
    const payday = Math.round(median(incomeDays));
    // Compare the 6 days AFTER payday to the 6 lean days BEFORE it (equal windows) so fixed
    // commitments like rent/bills elsewhere in the month don't distort the baseline.
    let post = 0;
    let pre = 0;
    for (const t of spend) {
      const delta = (dom(t.date) - payday + 31) % 31;
      if (delta <= 5) post += Math.abs(t.amount);
      else if (delta >= 25) pre += Math.abs(t.amount);
    }
    const multiplier = +Math.min(3, post / Math.max(pre, 1)).toFixed(2); // cap runaway when pre≈0
    signals.push({
      id: 'post_payday_spending_multiplier',
      label: 'Post-payday spending',
      value: multiplier,
      unit: 'MULTIPLIER',
      confidence: tierFromCount(spend.length),
      detail: `In the days just after payday you spend about ${multiplier.toFixed(2)}× what you spend in the lean days just before it.`,
    });
  }

  // Savings withdrawal rate (from savings behaviour).
  const savings = analyseSavings(snapshot);
  if (savings.depositsPerMonth > 0) {
    signals.push({
      id: 'savings_withdrawal_rate',
      label: 'Savings withdrawal rate',
      value: savings.withdrawalRatePct,
      unit: 'PERCENT',
      confidence: savings.confidence,
      detail: `You withdraw about ${savings.withdrawalRatePct}% of what you transfer into savings back out again.`,
    });
  }

  return signals;
}

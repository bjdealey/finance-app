import type { FinancialSnapshot, ConfidenceTier } from './types';
import { isSpend, analyseSavings } from './behaviour';
import { completeMonthsBefore, monthKey } from './dates';
import { median } from './stats';
import { formatGBP } from './money';

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

  // Category lookups for the category-based signals below.
  const catByName = new Map(snapshot.categories.map((c) => [c.name.toLowerCase(), c.id]));
  const inCat = (id: string | undefined) => (id ? spend.filter((t) => t.categoryId === id) : []);

  // Subscription usage — recurring subscriptions as a share of all spending.
  const subsId = catByName.get('subscriptions');
  if (subsId) {
    const totalSpend = spend.reduce((s, t) => s + Math.abs(t.amount), 0);
    const subs = inCat(subsId);
    const subsSpend = subs.reduce((s, t) => s + Math.abs(t.amount), 0);
    if (totalSpend > 0 && subsSpend > 0) {
      const pct = Math.round((subsSpend / totalSpend) * 100);
      signals.push({
        id: 'subscription_usage',
        label: 'Subscriptions',
        value: pct,
        unit: 'PERCENT',
        confidence: tierFromCount(subs.length),
        detail: `Subscriptions are about ${pct}% of your spending — roughly ${formatGBP(Math.round(subsSpend / months.size))} a month.`,
      });
    }
  }

  // Credit-card payment behaviour — how often a balance carried (you were charged interest).
  const cardIds = new Set(snapshot.accounts.filter((a) => a.accountType === 'CREDIT_CARD').map((a) => a.id));
  if (cardIds.size > 0) {
    const interestMonths = new Set<string>();
    let cardTxns = 0;
    for (const t of snapshot.transactions) {
      if (!cardIds.has(t.accountId) || !months.has(monthKey(t.date))) continue;
      cardTxns++;
      if (t.transactionType === 'INTEREST' && t.amount < 0) interestMonths.add(monthKey(t.date));
    }
    const pct = Math.round((interestMonths.size / months.size) * 100);
    signals.push({
      id: 'credit_card_payment_behaviour',
      label: 'Card interest',
      value: pct,
      unit: 'PERCENT',
      confidence: tierFromCount(cardTxns),
      detail: pct > 0
        ? `You were charged credit-card interest in about ${pct}% of the last 12 months — that happens when a balance carries past the statement date.`
        : `You cleared your credit cards without being charged interest over the last 12 months.`,
    });
  }

  // Seasonal travel — summer (Jun–Aug) travel spend vs the rest of the year.
  const travelId = catByName.get('travel');
  if (travelId) {
    const SUMMER = new Set([6, 7, 8]);
    let summerTotal = 0;
    let otherTotal = 0;
    const summerMonths = new Set<string>();
    const otherMonths = new Set<string>();
    for (const t of inCat(travelId)) {
      const mk = monthKey(t.date);
      if (SUMMER.has(+mk.slice(5, 7))) {
        summerTotal += Math.abs(t.amount);
        summerMonths.add(mk);
      } else {
        otherTotal += Math.abs(t.amount);
        otherMonths.add(mk);
      }
    }
    const summerAvg = summerMonths.size ? summerTotal / summerMonths.size : 0;
    const otherAvg = otherMonths.size ? otherTotal / otherMonths.size : 0;
    if (summerAvg > 0 && summerMonths.size + otherMonths.size >= 2) {
      const mult = +Math.min(9, summerAvg / Math.max(otherAvg, 1)).toFixed(2);
      signals.push({
        id: 'travel_spending_multiplier',
        label: 'Summer travel',
        value: mult,
        unit: 'MULTIPLIER',
        confidence: tierFromCount(inCat(travelId).length),
        detail: `You spend about ${mult.toFixed(2)}× as much per month on travel in summer (Jun–Aug) as the rest of the year.`,
      });
    }
  }

  return signals;
}

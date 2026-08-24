import type { FinancialSnapshot, Transaction, ConfidenceTier, AccountType } from './types';
import { isInternalTransfer } from './ledger';
import { completeMonthsBefore, monthKey } from './dates';
import { mean, median, stdev, clamp0 } from './stats';

const WINDOW = 12;

// A transaction that reduces net worth through spending (outflow, not an internal transfer).
export function isSpend(t: Transaction): boolean {
  return t.status !== 'REVERSED' && t.amount < 0 && !isInternalTransfer(t);
}

export interface CategoryStat {
  categoryId: string;
  monthlyTotals: number[]; // pence per month, chronological, zeros filled
  monthlyAverage: number;
  median: number;
  stddev: number;
  recentAverage: number; // last 3 months
  trend: 'RISING' | 'FALLING' | 'STABLE';
  min: number;
  max: number;
  expectedMonthlySpend: number; // recent-weighted baseline
  likelyRange: [number, number];
  highSpendThreshold: number;
  activeMonths: number;
  confidence: ConfidenceTier;
}

export function confidenceFromActiveMonths(active: number): ConfidenceTier {
  if (active < 2) return 'INSUFFICIENT_DATA';
  if (active < 5) return 'LOW';
  if (active < 8) return 'MEDIUM';
  return 'HIGH';
}

// categoryId -> monthKey -> total spend magnitude (pence), restricted to the given months.
function spendByCategoryMonth(snapshot: FinancialSnapshot, months: string[]): Map<string, Map<string, number>> {
  const monthSet = new Set(months);
  const idx = new Map<string, Map<string, number>>();
  for (const t of snapshot.transactions) {
    if (!isSpend(t)) continue;
    const mk = monthKey(t.date);
    if (!monthSet.has(mk)) continue;
    const cid = t.categoryId ?? 'UNCATEGORISED';
    let mm = idx.get(cid);
    if (!mm) idx.set(cid, (mm = new Map()));
    mm.set(mk, (mm.get(mk) ?? 0) + Math.abs(t.amount));
  }
  return idx;
}

export function computeCategoryStat(categoryId: string, totals: number[]): CategoryStat {
  const monthlyAverage = Math.round(mean(totals));
  const md = Math.round(median(totals));
  const sd = Math.round(stdev(totals));
  const recent = totals.slice(-3);
  const earlier = totals.slice(0, Math.max(0, totals.length - 3));
  const recentAverage = Math.round(mean(recent));
  const earlierAverage = mean(earlier);

  let trend: CategoryStat['trend'] = 'STABLE';
  if (earlierAverage === 0 && recentAverage > 0) trend = 'RISING';
  else if (earlierAverage > 0) {
    const ratio = recentAverage / earlierAverage;
    if (ratio > 1.12) trend = 'RISING';
    else if (ratio < 0.88) trend = 'FALLING';
  }

  const activeMonths = totals.filter((x) => x > 0).length;
  const expectedMonthlySpend = Math.round(0.5 * monthlyAverage + 0.5 * recentAverage);
  return {
    categoryId,
    monthlyTotals: totals,
    monthlyAverage,
    median: md,
    stddev: sd,
    recentAverage,
    trend,
    min: Math.min(...totals),
    max: Math.max(...totals),
    expectedMonthlySpend,
    likelyRange: [Math.round(clamp0(monthlyAverage - sd)), Math.round(monthlyAverage + sd)],
    highSpendThreshold: Math.round(monthlyAverage + 1.5 * sd),
    activeMonths,
    confidence: confidenceFromActiveMonths(activeMonths),
  };
}

// Per-category behavioural statistics over the last 12 complete months. Excludes transfers.
export function analyseCategories(snapshot: FinancialSnapshot): CategoryStat[] {
  const months = completeMonthsBefore(snapshot.asOf, WINDOW);
  const byCat = spendByCategoryMonth(snapshot, months);
  const stats: CategoryStat[] = [];
  for (const [categoryId, monthMap] of byCat) {
    const totals = months.map((mk) => monthMap.get(mk) ?? 0);
    stats.push(computeCategoryStat(categoryId, totals));
  }
  return stats.sort((a, b) => b.monthlyAverage - a.monthlyAverage);
}

export function categoryStat(snapshot: FinancialSnapshot, categoryId: string): CategoryStat {
  const months = completeMonthsBefore(snapshot.asOf, WINDOW);
  const byCat = spendByCategoryMonth(snapshot, months);
  const monthMap = byCat.get(categoryId) ?? new Map();
  return computeCategoryStat(categoryId, months.map((mk) => monthMap.get(mk) ?? 0));
}

// ---- Savings behaviour (spec §11) -----------------------------------------
const LIQUID_SAVINGS: AccountType[] = ['SAVINGS', 'CASH_ISA'];

export interface SavingsBehaviour {
  months: number;
  depositsPerMonth: number; // pence transferred INTO savings
  withdrawalsPerMonth: number; // pence transferred OUT of savings
  netPerMonth: number; // deposits - withdrawals
  withdrawalRatePct: number; // withdrawals / deposits * 100
  confidence: ConfidenceTier;
}

// Net savings behaviour: money moved into savings vs money pulled back out (transfers only).
export function analyseSavings(snapshot: FinancialSnapshot): SavingsBehaviour {
  const months = completeMonthsBefore(snapshot.asOf, WINDOW);
  const monthSet = new Set(months);
  const savingsIds = new Set(snapshot.accounts.filter((a) => LIQUID_SAVINGS.includes(a.accountType)).map((a) => a.id));

  let deposits = 0;
  let withdrawals = 0;
  const activeMonths = new Set<string>();
  for (const t of snapshot.transactions) {
    if (t.transactionType !== 'TRANSFER') continue;
    if (!savingsIds.has(t.accountId)) continue;
    const mk = monthKey(t.date);
    if (!monthSet.has(mk)) continue;
    activeMonths.add(mk);
    if (t.amount > 0) deposits += t.amount;
    else withdrawals += Math.abs(t.amount);
  }
  const n = months.length;
  const depositsPerMonth = Math.round(deposits / n);
  const withdrawalsPerMonth = Math.round(withdrawals / n);
  return {
    months: n,
    depositsPerMonth,
    withdrawalsPerMonth,
    netPerMonth: depositsPerMonth - withdrawalsPerMonth,
    withdrawalRatePct: deposits > 0 ? Math.round((withdrawals / deposits) * 100) : 0,
    confidence: confidenceFromActiveMonths(activeMonths.size),
  };
}

import type { FinancialSnapshot, Transaction } from './types';
import { mean, median, stdev } from './stats';
import { addDaysISO, addMonthsISO } from './dates';

export type Frequency = 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'IRREGULAR';

export interface RecurringSeries {
  key: string;
  merchant: string;
  accountId: string; // dominant account the series flows through
  isTransfer: boolean; // internal transfer / card payment (not spending)
  direction: 'INCOME' | 'EXPENSE';
  frequency: Frequency;
  count: number;
  expectedAmount: number; // pence magnitude
  amountMin: number;
  amountMax: number;
  amountVariancePct: number;
  isVariable: boolean;
  intervalDays: number; // median gap
  dateVarianceDays: number;
  lastDate: string;
  nextExpectedDate: string;
  confidence: number; // 0-100
  categoryId: string | null;
}

function mode(xs: string[]): string {
  const counts = new Map<string, number>();
  let best = xs[0];
  let bestN = 0;
  for (const x of xs) {
    const n = (counts.get(x) ?? 0) + 1;
    counts.set(x, n);
    if (n > bestN) {
      bestN = n;
      best = x;
    }
  }
  return best;
}

function normKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function classify(medianDays: number): Frequency {
  if (medianDays >= 6 && medianDays <= 8) return 'WEEKLY';
  if (medianDays >= 12 && medianDays <= 16) return 'FORTNIGHTLY';
  if (medianDays >= 26 && medianDays <= 35) return 'MONTHLY';
  if (medianDays >= 84 && medianDays <= 96) return 'QUARTERLY';
  if (medianDays >= 350 && medianDays <= 380) return 'ANNUAL';
  return 'IRREGULAR';
}

function nextDate(last: string, freq: Frequency, medianDays: number): string {
  switch (freq) {
    case 'WEEKLY':
      return addDaysISO(last, 7);
    case 'FORTNIGHTLY':
      return addDaysISO(last, 14);
    case 'MONTHLY':
      return addMonthsISO(last, 1);
    case 'QUARTERLY':
      return addMonthsISO(last, 3);
    case 'ANNUAL':
      return addMonthsISO(last, 12);
    default:
      return addDaysISO(last, Math.round(medianDays) || 30);
  }
}

// Detect recurring income/bills/subscriptions/scheduled transfers. Groups by merchant AND account
// (so both legs of a transfer are separate series with clean per-account attribution — the forecast
// then nets internal transfers whose two legs are both on current accounts).
export function detectRecurring(snapshot: FinancialSnapshot, opts: { minCount?: number } = {}): RecurringSeries[] {
  const minCount = opts.minCount ?? 3;
  const candidates = snapshot.transactions.filter((t) => t.status !== 'REVERSED');

  const groups = new Map<string, Transaction[]>();
  for (const t of candidates) {
    const label = t.merchant ?? t.description ?? '';
    const nk = normKey(label);
    if (!nk) continue;
    const gkey = `${nk}|${t.accountId}`; // '|' can't appear in the letter-only key or a uuid
    let arr = groups.get(gkey);
    if (!arr) groups.set(gkey, (arr = []));
    arr.push(t);
  }

  const series: RecurringSeries[] = [];
  for (const [gkey, txns] of groups) {
    if (txns.length < minCount) continue;
    const key = gkey.slice(0, gkey.indexOf('|'));
    const sorted = [...txns].sort((a, b) => a.date.localeCompare(b.date));
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      intervals.push((Date.parse(sorted[i].date) - Date.parse(sorted[i - 1].date)) / 86_400_000);
    }
    const medInterval = median(intervals);
    const intervalSd = stdev(intervals);
    const freq = classify(medInterval);

    const mags = sorted.map((t) => Math.abs(t.amount));
    const avgMag = mean(mags);
    const expectedAmount = Math.round(median(mags));
    const variancePct = avgMag > 0 ? Math.round((stdev(mags) / avgMag) * 100) : 0;

    // Confidence: interval regularity + occurrence count; irregular cadence is capped low.
    const regularity = medInterval > 0 ? Math.max(0, 1 - intervalSd / medInterval) : 0;
    const countFactor = Math.min(1, sorted.length / 6);
    let confidence = Math.round(100 * (0.55 * regularity + 0.45 * countFactor));
    if (freq === 'IRREGULAR') confidence = Math.min(confidence, 40);

    const last = sorted[sorted.length - 1].date;
    const transferCount = sorted.filter((t) => t.transactionType === 'TRANSFER' || t.transactionType === 'CARD_PAYMENT').length;
    series.push({
      key,
      merchant: sorted[sorted.length - 1].merchant ?? sorted[sorted.length - 1].description ?? key,
      accountId: mode(sorted.map((t) => t.accountId)),
      isTransfer: transferCount * 2 >= sorted.length,
      direction: median(sorted.map((t) => t.amount)) >= 0 ? 'INCOME' : 'EXPENSE',
      frequency: freq,
      count: sorted.length,
      expectedAmount,
      amountMin: Math.min(...mags),
      amountMax: Math.max(...mags),
      amountVariancePct: variancePct,
      isVariable: variancePct > 10,
      intervalDays: Math.round(medInterval),
      dateVarianceDays: Math.round(intervalSd),
      lastDate: last,
      nextExpectedDate: nextDate(last, freq, medInterval),
      confidence,
      categoryId: sorted[sorted.length - 1].categoryId,
    });
  }
  return series.sort((a, b) => b.confidence - a.confidence);
}

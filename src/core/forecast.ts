import type { FinancialSnapshot } from './types';
import { computeBalances } from './ledger';
import { detectRecurring, type Frequency } from './recurring';
import { analyseCategories } from './behaviour';
import { addDaysISO, addMonthsISO } from './dates';

export type ForecastSource = 'KNOWN' | 'RECURRING' | 'PREDICTED' | 'USER_ENTERED';

export interface ForecastItem {
  date: string;
  amount: number; // signed pence
  label: string;
  source: ForecastSource;
}

export interface Forecast {
  asOf: string;
  horizonDays: number;
  openingBalance: number; // current-account cash now
  items: ForecastItem[]; // chronological
  totalIn: number;
  totalOut: number;
  projectedBalance: number;
  low: number; // confidence band (wider with more predicted spend)
  high: number;
}

const MIN_CONFIDENCE = 50;

function occurrencesPerMonth(f: Frequency, intervalDays: number): number {
  switch (f) {
    case 'WEEKLY':
      return 30.4 / 7;
    case 'FORTNIGHTLY':
      return 30.4 / 14;
    case 'MONTHLY':
      return 1;
    case 'QUARTERLY':
      return 1 / 3;
    case 'ANNUAL':
      return 1 / 12;
    default:
      return 30.4 / Math.max(intervalDays, 1);
  }
}

function stepDate(iso: string, f: Frequency, intervalDays: number): string {
  switch (f) {
    case 'WEEKLY':
      return addDaysISO(iso, 7);
    case 'FORTNIGHTLY':
      return addDaysISO(iso, 14);
    case 'MONTHLY':
      return addMonthsISO(iso, 1);
    case 'QUARTERLY':
      return addMonthsISO(iso, 3);
    case 'ANNUAL':
      return addMonthsISO(iso, 12);
    default:
      return addDaysISO(iso, Math.round(intervalDays) || 30);
  }
}

function futureOccurrences(start: string, f: Frequency, intervalDays: number, after: string, until: string): string[] {
  const out: string[] = [];
  let d = start;
  let guard = 0;
  while (d <= after && guard++ < 1000) d = stepDate(d, f, intervalDays);
  guard = 0;
  while (d <= until && guard++ < 1000) {
    out.push(d);
    d = stepDate(d, f, intervalDays);
  }
  return out;
}

// Deterministic cash-flow forecast for the current accounts: dated recurring income/bills/transfers
// (source RECURRING) plus behavioural discretionary spend not explained by recurring bills
// (source PREDICTED). Reproducible from the same snapshot.
export function forecast(snapshot: FinancialSnapshot, horizonDays: number): Forecast {
  const asOf = snapshot.asOf;
  const horizonEnd = addDaysISO(asOf, horizonDays);
  const balances = new Map(computeBalances(snapshot).map((b) => [b.accountId, b.balance]));
  const currentIds = new Set(snapshot.accounts.filter((a) => a.accountType === 'CURRENT').map((a) => a.id));
  const openingBalance = snapshot.accounts
    .filter((a) => currentIds.has(a.id))
    .reduce((s, a) => s + (balances.get(a.id) ?? 0), 0);

  const recurring = detectRecurring(snapshot).filter((r) => r.confidence >= MIN_CONFIDENCE && currentIds.has(r.accountId));

  const items: ForecastItem[] = [];
  let recurringFixedExpenseMonthly = 0;
  for (const r of recurring) {
    const sign = r.direction === 'INCOME' ? 1 : -1;
    for (const d of futureOccurrences(r.nextExpectedDate, r.frequency, r.intervalDays, asOf, horizonEnd)) {
      items.push({ date: d, amount: sign * r.expectedAmount, label: r.merchant, source: 'RECURRING' });
    }
    if (r.direction === 'EXPENSE' && !r.isTransfer) {
      recurringFixedExpenseMonthly += r.expectedAmount * occurrencesPerMonth(r.frequency, r.intervalDays);
    }
  }

  // Predicted discretionary = behavioural monthly spend minus what recurring bills already cover.
  const behaviouralMonthly = analyseCategories(snapshot).reduce((s, c) => s + c.monthlyAverage, 0);
  const predictedMonthly = Math.max(0, behaviouralMonthly - recurringFixedExpenseMonthly);
  const predictedDaily = predictedMonthly / 30.4;
  const weeks = Math.ceil(horizonDays / 7);
  for (let w = 0; w < weeks; w++) {
    const days = Math.min(7, horizonDays - w * 7);
    if (days <= 0) break;
    const mid = addDaysISO(asOf, Math.min(horizonDays, w * 7 + Math.ceil(days / 2)));
    items.push({ date: mid, amount: -Math.round(predictedDaily * days), label: 'Predicted discretionary spending', source: 'PREDICTED' });
  }

  items.sort((a, b) => a.date.localeCompare(b.date));
  const totalIn = items.filter((i) => i.amount > 0).reduce((s, i) => s + i.amount, 0);
  const totalOut = items.filter((i) => i.amount < 0).reduce((s, i) => s + i.amount, 0);
  const projectedBalance = openingBalance + totalIn + totalOut;
  const predictedTotal = Math.abs(
    items.filter((i) => i.source === 'PREDICTED').reduce((s, i) => s + i.amount, 0),
  );
  const band = Math.round(0.2 * predictedTotal); // predicted spend is the uncertain part
  return { asOf, horizonDays, openingBalance, items, totalIn, totalOut, projectedBalance, low: projectedBalance - band, high: projectedBalance + band };
}

export const HORIZONS = [7, 30, 90, 365] as const;

export function forecastHorizons(snapshot: FinancialSnapshot): Record<number, Forecast> {
  return Object.fromEntries(HORIZONS.map((h) => [h, forecast(snapshot, h)]));
}

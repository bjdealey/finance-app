import type { FinancialSnapshot } from './types';
import { computeBalances } from './ledger';
import { detectRecurring, type Frequency } from './recurring';
import { analyseCategories } from './behaviour';
import { addDaysISO, addMonthsISO, ym } from './dates';

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

// The dates on which a given day-of-month falls within (after, until], clamped to short months.
function monthlyDueDates(dueDay: number, after: string, until: string): string[] {
  const out: string[] = [];
  let { y, m } = ym(after);
  for (let guard = 0; guard < 14 && out.length < 14; guard++) {
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate(); // day 0 of next month = last day of this
    const d = `${y}-${String(m).padStart(2, '0')}-${String(Math.min(dueDay, lastDay)).padStart(2, '0')}`;
    if (d > until) break;
    if (d > after) out.push(d);
    if (++m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
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
  let recurringUncertainty = 0; // pence of amount spread from VARIABLE recurring bills within the horizon
  for (const r of recurring) {
    const sign = r.direction === 'INCOME' ? 1 : -1;
    const occs = futureOccurrences(r.nextExpectedDate, r.frequency, r.intervalDays, asOf, horizonEnd);
    for (const d of occs) {
      items.push({ date: d, amount: sign * r.expectedAmount, label: r.merchant, source: 'RECURRING' });
    }
    if (r.isVariable) recurringUncertainty += occs.length * r.expectedAmount * (r.amountVariancePct / 100);
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

  // Scheduled loan/mortgage payments (spec §6): committed minimum payments on their due day,
  // funded from current-account cash. Only for debt accounts with NO transaction history — once
  // real payments exist, recurring detection is the source of truth and emitting here would
  // double-count. (Credit cards are left to the optimiser's pay-down, so they're excluded.)
  // ponytail: metadata-only onboarding case; drop this once a payment link between the current
  // account and the debt is modelled explicitly.
  const debtWithHistory = new Set(snapshot.transactions.map((t) => t.accountId));
  for (const a of snapshot.accounts) {
    if (a.accountType !== 'LOAN' && a.accountType !== 'MORTGAGE') continue;
    if (!a.minimumPayment || !a.paymentDueDay || debtWithHistory.has(a.id)) continue;
    for (const d of monthlyDueDates(a.paymentDueDay, asOf, horizonEnd)) {
      items.push({ date: d, amount: -Math.abs(a.minimumPayment), label: `${a.name} payment`, source: 'KNOWN' });
    }
  }

  // Known / user-entered: pending (not-yet-settled) transactions on current accounts within the
  // horizon. A future-dated MANUAL entry is a USER_ENTERED plan; any other pending item is KNOWN.
  for (const t of snapshot.transactions) {
    if (t.status !== 'PENDING' || !currentIds.has(t.accountId)) continue;
    if (t.date <= asOf || t.date > horizonEnd) continue;
    items.push({
      date: t.date,
      amount: t.amount,
      label: t.merchant ?? t.description ?? (t.amount < 0 ? 'Planned payment' : 'Planned income'),
      source: t.source === 'MANUAL' ? 'USER_ENTERED' : 'KNOWN',
    });
  }

  items.sort((a, b) => a.date.localeCompare(b.date));
  const totalIn = items.filter((i) => i.amount > 0).reduce((s, i) => s + i.amount, 0);
  const totalOut = items.filter((i) => i.amount < 0).reduce((s, i) => s + i.amount, 0);
  const projectedBalance = openingBalance + totalIn + totalOut;
  const predictedTotal = Math.abs(
    items.filter((i) => i.source === 'PREDICTED').reduce((s, i) => s + i.amount, 0),
  );
  // Uncertainty = predicted-discretionary spread + variable recurring-bill spread. They're
  // independent, so combine in quadrature. KNOWN / USER_ENTERED items are treated as certain.
  const predictedBand = 0.2 * predictedTotal;
  const band = Math.round(Math.sqrt(predictedBand * predictedBand + recurringUncertainty * recurringUncertainty));
  return { asOf, horizonDays, openingBalance, items, totalIn, totalOut, projectedBalance, low: projectedBalance - band, high: projectedBalance + band };
}

export const HORIZONS = [7, 30, 90, 365] as const;

export function forecastHorizons(snapshot: FinancialSnapshot): Record<number, Forecast> {
  return Object.fromEntries(HORIZONS.map((h) => [h, forecast(snapshot, h)]));
}

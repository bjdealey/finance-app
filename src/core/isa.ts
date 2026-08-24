import type { FinancialSnapshot } from './types';
import { ym } from './dates';

// UK ISA allowance: £20,000 of NEW money per tax year, combined across every ISA wrapper (Cash +
// Stocks & Shares). A const so a future tax year / country can override it without touching callers.
export const ISA_ANNUAL_ALLOWANCE_PENCE = 20_000_00;

export interface IsaAllowance {
  annualAllowance: number;
  used: number; // contributions paid into ISA-wrapped accounts this tax year (pence)
  remaining: number;
  taxYearStart: string; // YYYY-MM-DD
}

// The UK tax year runs 6 April – 5 April. Before 6 April we're still in the year that began the
// previous 6 April.
export function taxYearStart(asOf: string): string {
  const { y, m } = ym(asOf);
  const day = +asOf.slice(8, 10);
  const beforeApr6 = m < 4 || (m === 4 && day < 6);
  return `${beforeApr6 ? y - 1 : y}-04-06`;
}

// New money paid into ISA-wrapped accounts since the tax-year start. Interest earned inside the
// wrapper doesn't use allowance, so only TRANSFER/INCOME inflows count — not INTEREST.
// ponytail: counts every inflow as a fresh subscription; ISA-to-ISA transfers (which don't use
// allowance) would be double-counted — add wrapper-to-wrapper detection if that case matters.
export function isaAllowance(snapshot: FinancialSnapshot): IsaAllowance {
  const start = taxYearStart(snapshot.asOf);
  const isaIds = new Set(snapshot.accounts.filter((a) => a.taxWrapper != null).map((a) => a.id));
  let used = 0;
  for (const t of snapshot.transactions) {
    if (!isaIds.has(t.accountId) || t.amount <= 0) continue;
    if (t.date < start || t.date > snapshot.asOf) continue;
    if (t.transactionType === 'TRANSFER' || t.transactionType === 'INCOME') used += t.amount;
  }
  return {
    annualAllowance: ISA_ANNUAL_ALLOWANCE_PENCE,
    used,
    remaining: Math.max(0, ISA_ANNUAL_ALLOWANCE_PENCE - used),
    taxYearStart: start,
  };
}

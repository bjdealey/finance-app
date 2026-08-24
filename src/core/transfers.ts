import type { Transaction } from './types';

// Detect internal transfers in imported (untagged) data: a debit in one account matched to a
// near-equal credit in ANOTHER account within a few days. Pure — returns pairs of transaction ids;
// the caller assigns a shared group id and persists. Already-grouped transactions are skipped.
//
// Deterministic regardless of input order: legs are ordered by (date, id) before matching, and each
// debit takes the CLOSEST-in-date eligible credit (then closest amount, then lowest id) rather than
// whatever happened to come first — so unordered DB rows and equal-amount coincidences can't swing
// the pairing. Reproducibility matters here (spec §37/§38); the DB feeds rows in arbitrary order.
// ponytail: O(n²) greedy nearest-match, not a global optimum. Fine for personal volumes; for a true
// minimum-total-distance assignment you'd need Hungarian, which no personal ledger warrants.
export function detectTransfers(
  txns: Transaction[],
  opts: { maxDays?: number; tolerancePence?: number } = {},
): [string, string][] {
  const maxDays = opts.maxDays ?? 3;
  const tol = opts.tolerancePence ?? 0;

  const candidates = txns.filter((t) => t.transferGroupId == null && t.status !== 'REVERSED');
  const byOrder = (a: Transaction, b: Transaction) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const debits = candidates.filter((t) => t.amount < 0).sort(byOrder);
  const credits = candidates.filter((t) => t.amount > 0).sort(byOrder);
  const used = new Set<string>();
  const pairs: [string, string][] = [];

  for (const d of debits) {
    if (used.has(d.id)) continue;
    // Pick the best eligible credit: nearest date, then nearest amount, then lowest id (via the stable
    // pre-sort). Strict `<` keeps the first in that deterministic order when scores tie.
    let best: Transaction | undefined;
    let bestGap = Infinity;
    let bestAmtDiff = Infinity;
    for (const c of credits) {
      if (used.has(c.id) || c.accountId === d.accountId) continue;
      const amtDiff = Math.abs(c.amount + d.amount); // 0 when they cancel exactly
      if (amtDiff > tol) continue;
      const gap = Math.abs(daysBetween(d.date, c.date));
      if (gap > maxDays) continue;
      if (gap < bestGap || (gap === bestGap && amtDiff < bestAmtDiff)) {
        best = c;
        bestGap = gap;
        bestAmtDiff = amtDiff;
      }
    }
    if (best) {
      used.add(d.id);
      used.add(best.id);
      pairs.push([d.id, best.id]);
    }
  }
  return pairs;
}

function daysBetween(a: string, b: string): number {
  const da = Date.parse(a + 'T00:00:00Z');
  const db = Date.parse(b + 'T00:00:00Z');
  return (db - da) / 86_400_000;
}

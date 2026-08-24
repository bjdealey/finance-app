import type { Transaction } from './types';

// Detect internal transfers in imported (untagged) data: a debit in one account matched to a
// near-equal credit in ANOTHER account within a few days. Pure — returns pairs of transaction ids;
// the caller assigns a shared group id and persists. Already-grouped transactions are skipped.
// ponytail: O(n²) greedy match. Fine for personal volumes; index by |amount| if it ever isn't.
export function detectTransfers(
  txns: Transaction[],
  opts: { maxDays?: number; tolerancePence?: number } = {},
): [string, string][] {
  const maxDays = opts.maxDays ?? 3;
  const tol = opts.tolerancePence ?? 0;

  const candidates = txns.filter((t) => t.transferGroupId == null && t.status !== 'REVERSED');
  const debits = candidates.filter((t) => t.amount < 0);
  const credits = candidates.filter((t) => t.amount > 0);
  const used = new Set<string>();
  const pairs: [string, string][] = [];

  for (const d of debits) {
    if (used.has(d.id)) continue;
    const match = credits.find(
      (c) =>
        !used.has(c.id) &&
        c.accountId !== d.accountId &&
        Math.abs(c.amount + d.amount) <= tol && // amounts cancel out
        Math.abs(daysBetween(d.date, c.date)) <= maxDays,
    );
    if (match) {
      used.add(d.id);
      used.add(match.id);
      pairs.push([d.id, match.id]);
    }
  }
  return pairs;
}

function daysBetween(a: string, b: string): number {
  const da = Date.parse(a + 'T00:00:00Z');
  const db = Date.parse(b + 'T00:00:00Z');
  return (db - da) / 86_400_000;
}

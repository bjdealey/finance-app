import { createHash } from 'node:crypto';
import { parseMoneyToPence } from './money';

// Pure CSV mapping/normalisation. The service layer does the actual file read (csv-parse),
// dedupe against the DB, categorisation and insert.

export interface ColumnMap {
  date?: string;
  description?: string;
  amount?: string; // single signed column
  debit?: string; // money out (positive magnitude)
  credit?: string; // money in (positive magnitude)
  balance?: string;
}

export interface ParsedRow {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // signed pence
  balance: number | null;
}

export type RowResult = { ok: true; row: ParsedRow } | { ok: false; error: string };

const ALIASES: Record<keyof ColumnMap, string[]> = {
  date: ['date', 'transaction date', 'trans date', 'posted', 'date posted', 'value date'],
  description: ['description', 'details', 'narrative', 'reference', 'memo', 'name', 'payee', 'merchant', 'transaction'],
  amount: ['amount', 'value', 'transaction amount'],
  debit: ['debit', 'paid out', 'money out', 'withdrawal', 'withdrawals', 'out', 'debit amount'],
  credit: ['credit', 'paid in', 'money in', 'deposit', 'deposits', 'in', 'credit amount'],
  balance: ['balance', 'running balance', 'balance after'],
};

const norm = (h: string) => h.toLowerCase().replace(/[_\-.]/g, ' ').replace(/\s+/g, ' ').trim();

// Best-effort mapping from CSV headers to known fields. Users can override in the UI.
export function detectColumns(headers: string[]): ColumnMap {
  const normalized = headers.map((h) => ({ raw: h, n: norm(h) }));
  const map: ColumnMap = {};
  for (const field of Object.keys(ALIASES) as (keyof ColumnMap)[]) {
    const aliases = ALIASES[field];
    // Prefer an exact normalized match, then a contains match.
    const exact = normalized.find((h) => aliases.includes(h.n));
    const partial = exact ?? normalized.find((h) => aliases.some((a) => h.n.includes(a)));
    if (partial) map[field] = partial.raw;
  }
  return map;
}

// Accepts YYYY-MM-DD, D/M/Y and D-M-Y (UK order), and "D Mon YYYY". Returns ISO or null.
export function parseDate(raw: string): string | null {
  const s = (raw ?? '').trim();
  if (!s) return null;
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/.exec(s); // UK day-first
  if (m) {
    const day = m[1].padStart(2, '0');
    const month = m[2].padStart(2, '0');
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    if (+month > 12) return null;
    return `${year}-${month}-${day}`;
  }
  const t = Date.parse(s);
  if (!Number.isNaN(t)) return new Date(t).toISOString().slice(0, 10);
  return null;
}

export function normalizeRow(record: Record<string, string>, map: ColumnMap): RowResult {
  if (!map.date) return { ok: false, error: 'No date column mapped' };
  const date = parseDate(record[map.date] ?? '');
  if (!date) return { ok: false, error: `Unparseable date: "${record[map.date] ?? ''}"` };

  const description = (map.description ? record[map.description] : '')?.trim() || 'Imported transaction';

  let amount: number | null = null;
  if (map.amount) {
    amount = parseMoneyToPence(record[map.amount]);
  } else if (map.debit || map.credit) {
    const debit = map.debit ? parseMoneyToPence(record[map.debit]) : null;
    const credit = map.credit ? parseMoneyToPence(record[map.credit]) : null;
    if (debit == null && credit == null) return { ok: false, error: 'No amount on row' };
    amount = (credit ? Math.abs(credit) : 0) - (debit ? Math.abs(debit) : 0);
  }
  if (amount == null) return { ok: false, error: 'No amount column mapped' };

  const balance = map.balance ? parseMoneyToPence(record[map.balance]) : null;
  return { ok: true, row: { date, description, amount, balance } };
}

// Advisory identity hash. NOT a unique constraint: two identical small purchases on the same day are
// legitimate. Used to skip re-imports and to flag (never drop) within-file repeats.
export function dedupeKey(accountId: string, date: string, amount: number, description: string): string {
  return createHash('sha256').update(`${accountId}|${date}|${amount}|${description}`).digest('hex');
}

export interface PlannedRow {
  row: ParsedRow;
  key: string;
  possibleDuplicate: boolean; // identical to an earlier row in THIS file — imported, but worth a look
}

// Partition parsed rows for import. A row whose key already exists in the account is dropped (a
// genuine statement re-import). A row identical to an earlier row in the SAME file is KEPT but
// flagged — dropping it would lose a real transaction and understate spending (schema §dedupe_key).
export function planDedupe(
  accountId: string,
  rows: ParsedRow[],
  existingKeys: Set<string>,
): { toInsert: PlannedRow[]; skipped: number; possibleDuplicates: number } {
  const seen = new Set<string>();
  const toInsert: PlannedRow[] = [];
  let skipped = 0;
  let possibleDuplicates = 0;
  for (const row of rows) {
    const key = dedupeKey(accountId, row.date, row.amount, row.description);
    if (existingKeys.has(key)) {
      skipped++; // already in the ledger from a prior import
      continue;
    }
    const possibleDuplicate = seen.has(key);
    if (possibleDuplicate) possibleDuplicates++;
    else seen.add(key);
    toInsert.push({ row, key, possibleDuplicate });
  }
  return { toInsert, skipped, possibleDuplicates };
}

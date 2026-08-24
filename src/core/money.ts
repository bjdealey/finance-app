// All monetary amounts in the engine are INTEGER PENCE.
// Sign convention: positive = money into the account, negative = money out.
// Never do money math in floats; convert only at these boundaries.

export function poundsToPence(pounds: number): number {
  return Math.round(pounds * 100);
}

export function penceToPounds(pence: number): number {
  return pence / 100;
}

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

export function formatGBP(pence: number): string {
  const v = pence / 100;
  return gbp.format(v === 0 ? 0 : v); // normalise -0 to 0 (v === 0 catches -0)
}

// Tolerant parser for CSV / manual input.
// Handles "£1,234.56", "-1234.56", "(1234.56)" (accounting negative), "1,234", "+50".
// Returns null when the value isn't a parseable amount.
export function parseMoneyToPence(raw: unknown): number | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (s === '') return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[£$,\s]/g, '');
  if (s.startsWith('-')) {
    negative = true;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const pence = Math.round(parseFloat(s) * 100);
  return negative ? -pence : pence;
}

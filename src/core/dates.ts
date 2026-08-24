// Date helpers over plain 'YYYY-MM-DD' strings — no timezone surprises.

export function monthKey(iso: string): string {
  return iso.slice(0, 7); // YYYY-MM
}

export function ym(iso: string): { y: number; m: number } {
  return { y: +iso.slice(0, 4), m: +iso.slice(5, 7) };
}

export function daysBetween(a: string, b: string): number {
  return (Date.parse(a) - Date.parse(b)) / 86_400_000;
}

export function addDaysISO(iso: string, days: number): string {
  return new Date(Date.parse(iso + 'T00:00:00Z') + days * 86_400_000).toISOString().slice(0, 10);
}

export function addMonthsISO(iso: string, months: number): string {
  const { y, m } = ym(iso);
  const day = +iso.slice(8, 10);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(ny, nm, 0)).getUTCDate(); // clamp e.g. Jan 31 -> Feb 28
  const d = Math.min(day, lastDay);
  return `${ny}-${String(nm).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// The `count` complete month keys (YYYY-MM) ending the month BEFORE the asOf month, chronological.
// Excludes the partial current month so averages aren't understated.
export function completeMonthsBefore(asOf: string, count: number): string[] {
  let { y, m } = ym(asOf);
  m -= 1;
  if (m === 0) {
    m = 12;
    y -= 1;
  }
  const keys: string[] = [];
  for (let i = 0; i < count; i++) {
    keys.push(`${y}-${String(m).padStart(2, '0')}`);
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return keys.reverse();
}

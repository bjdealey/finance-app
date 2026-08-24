const dmy = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const dm = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

// Parse a plain 'YYYY-MM-DD' as a local date (no timezone shift).
function parse(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDate(iso: string): string {
  return dmy.format(parse(iso));
}

export function formatDateShort(iso: string): string {
  return dm.format(parse(iso));
}

// Post-hoc grounding guardrail (spec §31/§32). The assistant must state no financial figure that
// didn't come from a tool result. On the way out we pull every money amount AND every percentage/rate
// from the model's answer and flag any whose value never appears in a tool output — a number the model
// may have invented rather than quoted. Money and percentages live in separate namespaces so "£22" and
// "22%" can't ground each other. Flagged figures are REDACTED before display (fail closed) — a warning
// that still shows the number would defeat the promise.
//
// ponytail: value-match heuristic (£/GBP/pounds + %). Doesn't catch word-form numbers ("twenty pounds",
// "22 percent") or ×-multipliers; upgrade to structured figure tags from the tools if evasion matters.

// £1,234.56 / -£500 / GBP 1,234 / 1,234 pounds
const MONEY_RE = /(?:£\s?|\bGBP\s?)\d[\d,]*(?:\.\d{1,2})?|\d[\d,]*(?:\.\d{1,2})?\s?(?:pounds?|GBP)\b/gi;
// 4.75% / 22 %
const PCT_RE = /\d[\d,]*(?:\.\d+)?\s?%/g;

const digits = (f: string): string => (f.match(/[\d.]/g) ?? []).join(''); // "£6,400.00" -> "6400.00"
const pounds = (n: string): string => n.split('.')[0];
const nums = (text: string, re: RegExp): string[] => (text.match(re) ?? []).map(digits).filter((n) => n !== '' && n !== '.');

interface Grounded {
  moneyFull: Set<string>;
  moneyPounds: Set<string>;
  pct: Set<string>;
}
function groundedSets(toolOutputs: string[]): Grounded {
  const corpus = toolOutputs.join(' ');
  const money = nums(corpus, MONEY_RE);
  return { moneyFull: new Set(money), moneyPounds: new Set(money.map(pounds)), pct: new Set(nums(corpus, PCT_RE)) };
}

// A pounds-only quote of a pence figure ("£6,400" for "£6,400.00") is fine; a rate must match exactly.
function isGrounded(figure: string, g: Grounded, kind: 'money' | 'pct'): boolean {
  const n = digits(figure);
  if (n === '' || n === '.') return true; // nothing numeric to check
  return kind === 'money' ? g.moneyFull.has(n) || g.moneyPounds.has(pounds(n)) : g.pct.has(n);
}

export function ungroundedFigures(text: string, toolOutputs: string[]): string[] {
  const g = groundedSets(toolOutputs);
  const out: string[] = [];
  for (const f of text.match(MONEY_RE) ?? []) if (!isGrounded(f, g, 'money')) out.push(f.trim());
  for (const f of text.match(PCT_RE) ?? []) if (!isGrounded(f, g, 'pct')) out.push(f.trim());
  return [...new Set(out)];
}

// Fail closed: replace every ungrounded figure with [unverified] so an unverified number is never
// shown as fact. Single-pass per namespace, so a grounded "£19,999" isn't corrupted by an ungrounded
// "£9,999" substring. Returns the redacted text and the distinct figures removed.
export function redactUngrounded(text: string, toolOutputs: string[]): { text: string; removed: string[] } {
  const g = groundedSets(toolOutputs);
  const removed: string[] = [];
  const strip = (kind: 'money' | 'pct') => (m: string): string => {
    if (isGrounded(m, g, kind)) return m;
    removed.push(m.trim());
    return '[unverified]';
  };
  const out = text.replace(MONEY_RE, strip('money')).replace(PCT_RE, strip('pct'));
  return { text: out, removed: [...new Set(removed)] };
}

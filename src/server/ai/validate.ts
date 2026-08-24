// Post-hoc grounding guardrail (spec §31/§32). The assistant's hard rule is that every money figure
// it states must come from a tool result. This is the belt-and-braces check on the way out: pull
// every £ figure from the model's answer and flag any whose value never appears in a tool output —
// i.e. a number the model may have invented rather than quoted.
const MONEY_RE = /-?£\s?\d[\d,]*(?:\.\d{1,2})?/g;
const norm = (f: string): string => f.replace(/[£,\s-]/g, '');
const pounds = (n: string): string => n.split('.')[0];

export function ungroundedFigures(text: string, toolOutputs: string[]): string[] {
  const grounded = (toolOutputs.join(' ').match(MONEY_RE) ?? []).map(norm);
  const groundedFull = new Set(grounded);
  const groundedPounds = new Set(grounded.map(pounds)); // so "£1,234" matches a tool's "£1,234.56"
  const out: string[] = [];
  for (const f of text.match(MONEY_RE) ?? []) {
    const n = norm(f);
    if (n === '') continue;
    if (groundedFull.has(n) || groundedPounds.has(pounds(n))) continue;
    out.push(f.trim());
  }
  return [...new Set(out)];
}

// One plain-language definition per finance term, shown at point of use via <Explainer>.
// A single canonical gloss keeps the wording identical everywhere a term appears (dashboard, health,
// forms) — the product's "no black box" POV applied to its own vocabulary. Warm and exact; state the
// meaning, never a figure the data already shows (e.g. the ISA limit is rendered next to the term).
export const GLOSSARY = {
  effectiveSavingsRate:
    'The share of your take-home income left after all your spending — the truest measure of how much you actually keep.',
  netSavingsRate:
    'What you move into savings minus what you pull back out, measured against your income.',
  cashRunway:
    'How many months your instantly-available cash would cover essential spending if your income stopped.',
  emergencyFund:
    'Easy-to-reach cash kept aside for the unexpected — commonly three to six months of essential spending.',
  isaAllowance:
    'The most you can pay into ISAs in a tax year while keeping the interest and growth tax-free.',
  liquidCash:
    'Money you could withdraw right now — no notice period and no penalty.',
} as const;

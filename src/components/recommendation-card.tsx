import type { ReactNode } from 'react';
import type { Recommendation, RecType } from '@/core/recommend';
import { Card, Money, Badge } from '@/components/ui';
import { formatGBP } from '@/core/money';

const TYPE_LABEL: Record<RecType, string> = {
  MOVE_CASH: 'Move cash',
  PAY_DEBT: 'Pay down debt',
  KEEP_BUFFER: 'Keep available',
  REDUCE_SPEND: 'Spending nudge',
  GOAL_CONTRIBUTION: 'Goal contribution',
};
const TYPE_TONE: Record<RecType, 'pos' | 'neg' | 'warn' | 'accent' | 'default'> = {
  MOVE_CASH: 'accent',
  PAY_DEBT: 'warn',
  KEEP_BUFFER: 'default',
  REDUCE_SPEND: 'warn',
  GOAL_CONTRIBUTION: 'accent',
};

function confidenceLabel(c: number): string {
  return c >= 90 ? 'High confidence' : c >= 70 ? 'Medium confidence' : 'Low confidence';
}

function benefitText(r: Recommendation): string | null {
  const b = r.expectedBenefit;
  if (!b) return null;
  if (b.aprAvoidedPence) return `≈ ${formatGBP(b.aprAvoidedPence)}/yr interest avoided`;
  if (b.annualInterestPence && b.annualInterestPence > 0) return `≈ ${formatGBP(b.annualInterestPence)}/yr more interest`;
  if (b.annualSavingPence) return `≈ ${formatGBP(b.annualSavingPence)}/yr freed up`;
  return null;
}

const humanCode = (c: string) => c.toLowerCase().replace(/_/g, ' ');

export function RecommendationCard({ rec, accountName, footer }: { rec: Recommendation; accountName: Map<string, string>; footer?: ReactNode }) {
  const benefit = benefitText(rec);
  return (
    <Card>
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Badge tone={TYPE_TONE[rec.type]}>{TYPE_LABEL[rec.type]}</Badge>
            <span className="text-xs text-muted">{confidenceLabel(rec.confidence)}</span>
          </div>
          <h3 className="font-medium">{rec.explanation.what}</h3>
          <p className="mt-1 text-sm text-muted">{rec.explanation.why}</p>
        </div>
        {benefit && <div className="shrink-0 rounded-lg bg-pos/10 px-2.5 py-1 text-xs font-medium text-pos">{benefit}</div>}
      </div>

      <details className="reveal group mt-3">
        <summary className="flex w-fit cursor-pointer items-center gap-1 py-2 text-sm text-primary-ink hover:underline [&::-webkit-details-marker]:hidden">
          Why this?
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className="text-muted transition-transform duration-200 group-open:rotate-90">
            <path d="M4.5 3 7.5 6 4.5 9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </summary>
        <div className="mt-3 space-y-2 border-l-2 border-border pl-4 text-sm">
          {rec.explanation.whyThisAccount && (
            <p><span className="font-medium">Why this account? </span><span className="text-muted">{rec.explanation.whyThisAccount}</span></p>
          )}
          {rec.explanation.whatIfIgnored && (
            <p><span className="font-medium">What if I don&apos;t? </span><span className="text-muted">{rec.explanation.whatIfIgnored}</span></p>
          )}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {rec.reasonCodes.map((c) => <Badge key={c}>{humanCode(c)}</Badge>)}
          </div>
          {rec.constraintsChecked.length > 0 && (
            <p className="pt-1 text-xs text-muted">
              Constraints checked: {rec.constraintsChecked.map(humanCode).join(', ')}
            </p>
          )}
          {(rec.sourceAccountId || rec.destinationAccountId) && (
            <p className="text-xs text-muted">
              {rec.sourceAccountId && <>From {accountName.get(rec.sourceAccountId) ?? '—'} </>}
              {rec.destinationAccountId && <>→ {accountName.get(rec.destinationAccountId) ?? '—'}</>}
            </p>
          )}
        </div>
      </details>
      {footer && <div className="mt-4 border-t border-border pt-3">{footer}</div>}
    </Card>
  );
}

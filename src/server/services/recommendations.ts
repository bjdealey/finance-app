import { eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { recommendations, type RecommendationRow } from '@/server/db/schema';
import type { Recommendation } from '@/core/recommend';

export type Decision = 'APPROVED' | 'REJECTED' | 'SNOOZED';

// Persisted decisions for a user, keyed by the engine's deterministic recommendation key.
export async function getDecisions(userId: string): Promise<Map<string, RecommendationRow>> {
  const rows = await db.select().from(recommendations).where(eq(recommendations.userId, userId));
  return new Map(rows.map((r) => [r.key, r]));
}

// Record (or update) the user's decision on a recommendation. No money is moved — this is an
// auditable record of intent only.
export async function decideRecommendation(
  userId: string,
  rec: Recommendation,
  status: Decision,
  snoozeDays?: number,
): Promise<void> {
  const now = new Date();
  const snoozeUntil = status === 'SNOOZED' && snoozeDays ? new Date(now.getTime() + snoozeDays * 86_400_000) : null;
  const shared = {
    type: rec.type,
    priority: rec.priority,
    sourceAccountId: rec.sourceAccountId,
    destinationAccountId: rec.destinationAccountId,
    amount: rec.amount,
    reasonCodes: rec.reasonCodes,
    constraintsChecked: rec.constraintsChecked,
    expectedBenefit: rec.expectedBenefit ?? undefined,
    confidence: rec.confidence,
    impact: rec.impact ?? undefined,
    explanationTrace: rec.explanation,
    status,
    snoozeUntil,
    decidedAt: now,
  };
  await db
    .insert(recommendations)
    .values({ userId, key: rec.id, ...shared })
    .onConflictDoUpdate({ target: [recommendations.userId, recommendations.key], set: shared });
}

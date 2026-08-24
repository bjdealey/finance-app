'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/server/auth/session';
import { getAnalysis } from '@/server/services/analysis';
import { decideRecommendation, type Decision } from '@/server/services/recommendations';

// Takes only the recommendation's id from the client and RE-DERIVES the recommendation from the
// user's own snapshot before recording it — so the persisted audit record is always the engine's
// own output for this user, never a blob the browser could have forged.
export async function decideAction(recId: string, status: Decision, snoozeDays?: number): Promise<void> {
  const user = await requireUser();
  const { recommendations } = await getAnalysis(user.id);
  const rec = recommendations.find((r) => r.id === recId);
  if (!rec) return; // unknown/stale id → nothing to record (the engine didn't produce this rec)
  await decideRecommendation(user.id, rec, status, snoozeDays);
  revalidatePath('/recommendations');
  revalidatePath('/dashboard');
}

'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/server/auth/session';
import { decideRecommendation, type Decision } from '@/server/services/recommendations';
import type { Recommendation } from '@/core/recommend';

export async function decideAction(rec: Recommendation, status: Decision, snoozeDays?: number): Promise<void> {
  const user = await requireUser();
  await decideRecommendation(user.id, rec, status, snoozeDays);
  revalidatePath('/recommendations');
  revalidatePath('/dashboard');
}

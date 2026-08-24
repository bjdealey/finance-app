import { and, eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { goals, type GoalRow } from '@/server/db/schema';

export interface GoalInput {
  name: string;
  targetAmount: number; // pence
  targetDate: string | null; // YYYY-MM-DD
  linkedAccountId: string | null;
  currentAmount: number; // pence — used only when no account is linked
  priority: number;
}

export async function getGoal(userId: string, id: string): Promise<GoalRow | null> {
  const [row] = await db
    .select()
    .from(goals)
    .where(and(eq(goals.id, id), eq(goals.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function createGoal(userId: string, input: GoalInput): Promise<void> {
  await db.insert(goals).values({ ...input, userId });
}

export async function updateGoal(userId: string, id: string, input: GoalInput): Promise<void> {
  await db
    .update(goals)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(goals.id, id), eq(goals.userId, userId)));
}

export async function deleteGoal(userId: string, id: string): Promise<void> {
  await db.delete(goals).where(and(eq(goals.id, id), eq(goals.userId, userId)));
}

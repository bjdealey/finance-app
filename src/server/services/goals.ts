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

// Untrusted route param: a malformed id would throw on the uuid cast (a 500-class error) instead of a
// 404. Gate it so a stale or hand-edited link resolves to the caller's notFound() 404.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getGoal(userId: string, id: string): Promise<GoalRow | null> {
  if (!UUID_RE.test(id)) return null;
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

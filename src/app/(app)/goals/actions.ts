'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser } from '@/server/auth/session';
import { createGoal, updateGoal, deleteGoal, getGoal, type GoalInput } from '@/server/services/goals';
import { parseMoneyToPence } from '@/core/money';

export interface GoalFormState {
  error?: string;
}

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  targetAmount: z.string().trim(),
  targetDate: z.string().trim().optional(),
  linkedAccountId: z.string().trim().optional(),
  currentAmount: z.string().trim().optional(),
  priority: z.string().trim().optional(),
});

function toInput(d: z.infer<typeof schema>): GoalInput | { error: string } {
  const target = parseMoneyToPence(d.targetAmount);
  if (target == null || target <= 0) return { error: 'Enter a target amount greater than zero.' };
  const current = d.currentAmount ? parseMoneyToPence(d.currentAmount) : 0;
  if (current == null || current < 0) return { error: 'Enter a valid "saved so far" amount, or leave it blank.' };
  const priority = d.priority ? parseInt(d.priority, 10) : 100;
  return {
    name: d.name,
    targetAmount: target,
    targetDate: d.targetDate || null,
    linkedAccountId: d.linkedAccountId || null,
    currentAmount: current,
    priority: Number.isInteger(priority) ? priority : 100,
  };
}

export async function createGoalAction(_prev: GoalFormState, formData: FormData): Promise<GoalFormState> {
  const user = await requireUser();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid details' };
  const input = toInput(parsed.data);
  if ('error' in input) return { error: input.error };
  await createGoal(user.id, input);
  revalidatePath('/goals');
  revalidatePath('/dashboard');
  redirect('/goals');
}

export async function updateGoalAction(id: string, _prev: GoalFormState, formData: FormData): Promise<GoalFormState> {
  const user = await requireUser();
  if (!(await getGoal(user.id, id))) return { error: 'Goal not found.' };
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid details' };
  const input = toInput(parsed.data);
  if ('error' in input) return { error: input.error };
  await updateGoal(user.id, id, input);
  revalidatePath('/goals');
  revalidatePath('/dashboard');
  redirect('/goals');
}

export async function deleteGoalAction(id: string): Promise<{ message: string; undo?: GoalInput }> {
  const user = await requireUser();
  const goal = await getGoal(user.id, id);
  await deleteGoal(user.id, id);
  revalidatePath('/goals');
  revalidatePath('/dashboard');
  const undo: GoalInput | undefined = goal
    ? {
        name: goal.name,
        targetAmount: goal.targetAmount,
        targetDate: goal.targetDate,
        linkedAccountId: goal.linkedAccountId,
        currentAmount: goal.currentAmount,
        priority: goal.priority,
      }
    : undefined;
  return { message: goal ? `Deleted "${goal.name}"` : 'Goal deleted', undo };
}

// Undo a delete — recreate the goal from the captured input.
export async function restoreGoalAction(input: GoalInput): Promise<void> {
  const user = await requireUser();
  await createGoal(user.id, input);
  revalidatePath('/goals');
  revalidatePath('/dashboard');
}

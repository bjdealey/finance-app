'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/server/auth/session';
import { correctCategory } from '@/server/services/transactions';

export async function correctCategoryAction(txnId: string, categoryId: string): Promise<void> {
  const user = await requireUser();
  await correctCategory(user.id, txnId, categoryId);
  revalidatePath('/transactions');
}

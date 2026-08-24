'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser } from '@/server/auth/session';
import { createCategory, renameCategory, deleteCategory, listCategoriesWithUsage } from '@/server/services/categories';

export interface CategoryFormState {
  error?: string;
}

const KINDS = ['EXPENSE', 'INCOME', 'TRANSFER', 'NEUTRAL'] as const;
const createSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(60),
  parentId: z.string().trim().optional(),
  kind: z.enum(KINDS).optional(),
});

// Refresh both the categories page and the whole app shell — renamed/new labels show everywhere.
function refresh() {
  revalidatePath('/categories');
  revalidatePath('/', 'layout');
}

export async function createCategoryAction(_prev: CategoryFormState, formData: FormData): Promise<CategoryFormState> {
  const user = await requireUser();
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid details' };
  const { name, parentId, kind } = parsed.data;
  if (parentId) {
    const cats = await listCategoriesWithUsage(user.id);
    const parent = cats.find((c) => c.id === parentId);
    if (!parent) return { error: 'Pick a valid parent category.' };
    if (parent.parentId) return { error: 'Categories can only nest one level deep.' };
  }
  await createCategory(user.id, { name, parentId: parentId || null, kind: kind ?? 'EXPENSE' });
  refresh();
  redirect('/categories');
}

// Plain form action (bound with the id): native `required`/`maxLength` guard the input.
export async function renameCategoryAction(id: string, formData: FormData): Promise<void> {
  const user = await requireUser();
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return;
  await renameCategory(user.id, id, name.slice(0, 60));
  refresh();
  redirect('/categories');
}

// The UI only enables Delete for removable categories; this re-checks and no-ops otherwise.
export async function deleteCategoryAction(id: string): Promise<void> {
  const user = await requireUser();
  await deleteCategory(user.id, id);
  refresh();
}

import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { categories, transactions } from '@/server/db/schema';
import type { CategoryKind } from '@/core/types';

export interface CategoryWithUsage {
  id: string;
  name: string;
  parentId: string | null;
  kind: CategoryKind;
  txnCount: number;
  childCount: number;
}

// Every category the user owns, with how many transactions use it and how many children it has —
// both gate whether it can be safely deleted.
export async function listCategoriesWithUsage(userId: string): Promise<CategoryWithUsage[]> {
  const [cats, counts] = await Promise.all([
    db.select().from(categories).where(eq(categories.userId, userId)).orderBy(asc(categories.name)),
    db
      .select({ categoryId: transactions.categoryId, n: sql<number>`count(*)::int` })
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .groupBy(transactions.categoryId),
  ]);
  const txnByCat = new Map(counts.map((c) => [c.categoryId, Number(c.n)]));
  const childByParent = new Map<string, number>();
  for (const c of cats) if (c.parentId) childByParent.set(c.parentId, (childByParent.get(c.parentId) ?? 0) + 1);
  return cats.map((c) => ({
    id: c.id,
    name: c.name,
    parentId: c.parentId,
    kind: c.kind,
    txnCount: txnByCat.get(c.id) ?? 0,
    childCount: childByParent.get(c.id) ?? 0,
  }));
}

export async function createCategory(userId: string, input: { name: string; parentId: string | null; kind: CategoryKind }): Promise<void> {
  await db.insert(categories).values({ userId, name: input.name, parentId: input.parentId, kind: input.kind });
}

// Rename only — amount-free and always safe (labels are derived, so nothing else needs migrating).
export async function renameCategory(userId: string, id: string, name: string): Promise<void> {
  await db.update(categories).set({ name }).where(and(eq(categories.id, id), eq(categories.userId, userId)));
}

// Delete, but only when nothing depends on it. category_rules cascade automatically; transactions
// don't (they'd be orphaned), so a category still in use is blocked with a clear reason.
export async function deleteCategory(userId: string, id: string): Promise<{ ok: true } | { error: string }> {
  const [cat] = await db.select().from(categories).where(and(eq(categories.id, id), eq(categories.userId, userId))).limit(1);
  if (!cat) return { error: 'Category not found.' };

  const [{ n: childN }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.parentId, id)));
  if (Number(childN) > 0) return { error: 'Remove or move its sub-categories first.' };

  const [{ n: txnN }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.categoryId, id)));
  if (Number(txnN) > 0) return { error: `${txnN} transaction(s) still use this category.` };

  await db.delete(categories).where(and(eq(categories.id, id), eq(categories.userId, userId)));
  return { ok: true };
}

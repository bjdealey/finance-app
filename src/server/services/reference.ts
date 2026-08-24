import { asc, eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { accounts, categories } from '@/server/db/schema';
import type { AccountType, CategoryKind } from '@/core/types';

export interface AccountRef { id: string; name: string; accountType: AccountType }
export interface CategoryRef { id: string; name: string; parentId: string | null; kind: CategoryKind }

export function listAccounts(userId: string): Promise<AccountRef[]> {
  return db
    .select({ id: accounts.id, name: accounts.name, accountType: accounts.accountType })
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .orderBy(asc(accounts.name));
}

export function listCategories(userId: string): Promise<CategoryRef[]> {
  return db
    .select({ id: categories.id, name: categories.name, parentId: categories.parentId, kind: categories.kind })
    .from(categories)
    .where(eq(categories.userId, userId))
    .orderBy(asc(categories.name));
}

// Build "Parent › Child" labels for category selects, sorted for display.
export function categoryOptions(cats: CategoryRef[]): { id: string; label: string }[] {
  const nameById = new Map(cats.map((c) => [c.id, c.name]));
  return cats
    .filter((c) => c.parentId !== null) // leaf categories are the selectable ones
    .map((c) => ({ id: c.id, label: `${nameById.get(c.parentId!) ?? ''} › ${c.name}` }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

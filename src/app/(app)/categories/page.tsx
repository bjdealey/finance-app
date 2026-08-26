import { requireUser } from '@/server/auth/session';
import { listCategoriesWithUsage, type CategoryWithUsage } from '@/server/services/categories';
import { Card, PageHeader } from '@/components/ui';
import { CategoryForm } from '@/components/category-form';
import { createCategoryAction, renameCategoryAction, deleteCategoryAction } from './actions';

export default async function CategoriesPage() {
  const user = await requireUser();
  const cats = await listCategoriesWithUsage(user.id);

  const roots = cats.filter((c) => !c.parentId);
  const childrenByParent = new Map<string, CategoryWithUsage[]>();
  for (const c of cats) if (c.parentId) (childrenByParent.get(c.parentId) ?? childrenByParent.set(c.parentId, []).get(c.parentId)!).push(c);

  // Roots first, each followed by its children; then any orphans (shouldn't normally exist).
  const ordered: CategoryWithUsage[] = [];
  for (const r of roots) {
    ordered.push(r);
    for (const ch of childrenByParent.get(r.id) ?? []) ordered.push(ch);
  }
  const seen = new Set(ordered.map((c) => c.id));
  for (const c of cats) if (!seen.has(c.id)) ordered.push(c);

  return (
    <div className="max-w-3xl">
      <PageHeader title="Categories" subtitle="Rename, add or remove the categories your spending is grouped into. A category still used by transactions can't be deleted until those move elsewhere." />

      <Card className="mb-8 p-0">
        <ul className="divide-y divide-border">
          {ordered.map((c) => {
            const inUse = c.txnCount > 0 || c.childCount > 0;
            return (
              <li key={c.id} className={`flex items-center justify-between gap-3 px-5 py-3 ${c.parentId ? 'pl-10' : ''}`}>
                <div className="min-w-0">
                  <span className="text-sm font-medium">{c.name}</span>
                  {!c.parentId && <span className="ml-2 text-xs text-muted">group</span>}
                  <span className="ml-2 text-xs text-muted">
                    {c.kind !== 'EXPENSE' ? `${c.kind.toLowerCase()} · ` : ''}
                    {c.txnCount} {c.txnCount === 1 ? 'txn' : 'txns'}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs">
                  <details className="relative">
                    <summary className="cursor-pointer list-none text-muted hover:text-fg">Rename</summary>
                    <form action={renameCategoryAction.bind(null, c.id)} className="absolute right-0 z-10 mt-1 flex gap-2 rounded-lg border border-border bg-surface p-2 shadow-lg shadow-black/5">
                      <input name="name" defaultValue={c.name} required maxLength={60} aria-label="New name" className="rounded border border-border bg-bg px-2 py-1 text-sm outline-none focus:border-primary" />
                      <button className="rounded bg-primary-strong px-2.5 py-1 font-medium text-primary-fg">Save</button>
                    </form>
                  </details>
                  {inUse ? (
                    <span className="cursor-not-allowed text-muted/50" title={c.childCount > 0 ? 'Has sub-categories — remove them first' : 'In use by transactions'}>Delete</span>
                  ) : (
                    <form action={deleteCategoryAction.bind(null, c.id)}>
                      <button className="text-muted hover:text-neg">Delete</button>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card>
        <h2 className="mb-4 font-semibold">Add a category</h2>
        <CategoryForm action={createCategoryAction} roots={roots.map((r) => ({ id: r.id, name: r.name }))} />
      </Card>
    </div>
  );
}

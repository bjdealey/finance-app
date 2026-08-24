// Build a map of categoryId -> "Parent › Child" display label. Pure (no server imports).
export function categoryLabels(cats: { id: string; name: string; parentId: string | null }[]): Map<string, string> {
  const name = new Map(cats.map((c) => [c.id, c.name]));
  const labels = new Map<string, string>();
  for (const c of cats) {
    labels.set(c.id, c.parentId ? `${name.get(c.parentId) ?? ''} › ${c.name}` : c.name);
  }
  return labels;
}

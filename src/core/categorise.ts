// Rule-based categorisation (no ML). Rules are checked in priority order; user corrections are
// stored as high-priority MERCHANT_EXACT rules so they win over seeded keyword rules.

export type MatchType = 'MERCHANT_EXACT' | 'KEYWORD' | 'REGEX';

export interface CatRule {
  matchType: MatchType;
  pattern: string;
  categoryId: string;
  priority: number; // lower = checked first
}

export interface Categorised {
  categoryId: string | null;
  confidence: number; // 0-100
}

// The distinctive leading word of a merchant, lower-cased with digits and punctuation stripped, so
// "TESCO STORES 2913" and "TESCO EXPRESS" both reduce to "tesco". Used as a KEYWORD rule pattern — a
// substring match that files a whole merchant family, not one exact string. null when there's no
// usable word (empty, or all digits/symbols).
export function merchantToken(merchant: string | null | undefined, minLength = 2): string | null {
  if (!merchant) return null;
  const first = merchant.toLowerCase().replace(/[^a-z\s]+/g, ' ').trim().split(/\s+/)[0] ?? '';
  return first.length >= minLength ? first : null;
}

export function categorise(
  txn: { merchant?: string | null; description?: string | null },
  rules: CatRule[],
): Categorised {
  const merchant = (txn.merchant ?? '').toLowerCase().trim();
  const haystack = [txn.merchant, txn.description].filter(Boolean).join(' ').toLowerCase();
  const ordered = [...rules].sort((a, b) => a.priority - b.priority);

  for (const r of ordered) {
    const pattern = r.pattern.toLowerCase().trim();
    let hit = false;
    if (r.matchType === 'MERCHANT_EXACT') hit = merchant === pattern;
    else if (r.matchType === 'KEYWORD') hit = pattern.length > 0 && haystack.includes(pattern);
    else if (r.matchType === 'REGEX') {
      try {
        hit = new RegExp(r.pattern, 'i').test(haystack);
      } catch {
        hit = false; // invalid user regex never throws through categorisation
      }
    }
    if (hit) {
      const confidence = r.matchType === 'MERCHANT_EXACT' ? 95 : r.matchType === 'REGEX' ? 85 : 80;
      return { categoryId: r.categoryId, confidence };
    }
  }
  return { categoryId: null, confidence: 0 };
}

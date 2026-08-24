import { describe, it, expect } from 'vitest';
import { categorise, type CatRule } from './categorise';

const rules: CatRule[] = [
  { matchType: 'KEYWORD', pattern: 'netflix', categoryId: 'subs', priority: 100 },
  { matchType: 'KEYWORD', pattern: 'tesco', categoryId: 'groceries', priority: 100 },
  { matchType: 'REGEX', pattern: '^amzn\\b', categoryId: 'shopping', priority: 120 },
];

describe('categorise', () => {
  it('matches on a keyword in merchant/description', () => {
    expect(categorise({ merchant: 'NETFLIX.COM' }, rules)).toEqual({ categoryId: 'subs', confidence: 80 });
    expect(categorise({ merchant: 'Tesco Stores 2891' }, rules).categoryId).toBe('groceries');
  });

  it('returns null with zero confidence when nothing matches', () => {
    expect(categorise({ merchant: 'Unknown Vendor' }, rules)).toEqual({ categoryId: null, confidence: 0 });
  });

  it('applies regex rules', () => {
    expect(categorise({ description: 'AMZN Mktp UK' }, rules).categoryId).toBe('shopping');
  });

  it('lets a high-priority user correction override a seeded keyword', () => {
    const withCorrection: CatRule[] = [
      { matchType: 'MERCHANT_EXACT', pattern: 'tesco petrol', categoryId: 'fuel', priority: 0 },
      ...rules,
    ];
    // "Tesco Petrol" contains "tesco" (keyword->groceries) but the exact merchant rule wins on priority.
    expect(categorise({ merchant: 'Tesco Petrol' }, withCorrection)).toEqual({ categoryId: 'fuel', confidence: 95 });
  });

  it('never throws on an invalid user regex', () => {
    const bad: CatRule[] = [{ matchType: 'REGEX', pattern: '([', categoryId: 'x', priority: 1 }];
    expect(() => categorise({ merchant: 'anything' }, bad)).not.toThrow();
    expect(categorise({ merchant: 'anything' }, bad).categoryId).toBeNull();
  });
});

import { describe, it, expect } from 'vitest';
import { categorise, merchantToken, type CatRule } from './categorise';

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

describe('merchantToken', () => {
  it('reduces a store-number variant to its leading word', () => {
    expect(merchantToken('TESCO STORES 2913')).toBe('tesco');
    expect(merchantToken('Tesco Express')).toBe('tesco'); // same token → one rule files the whole family
    expect(merchantToken('AMZN Mktp UK*Z1A2')).toBe('amzn');
  });

  it('feeds back into categorise as a KEYWORD rule that matches variants', () => {
    const token = merchantToken('TESCO STORES 2913')!;
    const rule: CatRule[] = [{ matchType: 'KEYWORD', pattern: token, categoryId: 'groceries', priority: 0 }];
    expect(categorise({ merchant: 'Tesco Express 44' }, rule).categoryId).toBe('groceries');
  });

  it('returns null when there is no usable word', () => {
    expect(merchantToken(null)).toBeNull();
    expect(merchantToken('')).toBeNull();
    expect(merchantToken('  1234 5678  ')).toBeNull(); // all digits → nothing to match on
    expect(merchantToken('A')).toBeNull(); // below the min length
  });
});

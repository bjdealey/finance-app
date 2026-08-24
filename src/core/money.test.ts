import { describe, it, expect } from 'vitest';
import { poundsToPence, penceToPounds, formatGBP, parseMoneyToPence } from './money';

describe('money', () => {
  it('converts pounds<->pence without float drift', () => {
    expect(poundsToPence(19.99)).toBe(1999);
    expect(poundsToPence(0.1 + 0.2)).toBe(30); // 0.30000000000000004 * 100 rounded
    expect(penceToPounds(1999)).toBe(19.99);
  });

  it('formats GBP including negatives', () => {
    expect(formatGBP(123456)).toBe('£1,234.56');
    expect(formatGBP(-84000)).toBe('-£840.00');
    expect(formatGBP(0)).toBe('£0.00');
  });

  it('parses tolerant money strings to pence', () => {
    expect(parseMoneyToPence('£1,234.56')).toBe(123456);
    expect(parseMoneyToPence('-1234.56')).toBe(-123456);
    expect(parseMoneyToPence('(1234.56)')).toBe(-123456); // accounting negative
    expect(parseMoneyToPence('1,234')).toBe(123400);
    expect(parseMoneyToPence('+50')).toBe(5000);
    expect(parseMoneyToPence('')).toBeNull();
    expect(parseMoneyToPence('n/a')).toBeNull();
    expect(parseMoneyToPence(null)).toBeNull();
  });
});

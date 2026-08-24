import { describe, it, expect } from 'vitest';
import { detectColumns, parseDate, normalizeRow, planDedupe, dedupeKey, type ParsedRow } from './import';

describe('import.detectColumns', () => {
  it('maps common single-amount headers', () => {
    expect(detectColumns(['Date', 'Description', 'Amount', 'Balance'])).toEqual({
      date: 'Date',
      description: 'Description',
      amount: 'Amount',
      balance: 'Balance',
    });
  });

  it('maps separate debit/credit headers with aliases', () => {
    const map = detectColumns(['Transaction Date', 'Details', 'Money Out', 'Money In', 'Running Balance']);
    expect(map.date).toBe('Transaction Date');
    expect(map.description).toBe('Details');
    expect(map.debit).toBe('Money Out');
    expect(map.credit).toBe('Money In');
  });
});

describe('import.parseDate', () => {
  it('parses ISO and UK day-first formats', () => {
    expect(parseDate('2026-03-09')).toBe('2026-03-09');
    expect(parseDate('09/03/2026')).toBe('2026-03-09'); // UK: 9 March
    expect(parseDate('9-3-26')).toBe('2026-03-09');
  });
  it('rejects impossible month and junk', () => {
    expect(parseDate('13/13/2026')).toBeNull();
    expect(parseDate('not a date')).toBeNull();
    expect(parseDate('')).toBeNull();
  });
});

describe('import.normalizeRow', () => {
  it('normalizes a signed-amount row to pence', () => {
    const r = normalizeRow({ Date: '01/06/2026', Description: 'TESCO', Amount: '-45.30' }, { date: 'Date', description: 'Description', amount: 'Amount' });
    expect(r).toEqual({ ok: true, row: { date: '2026-06-01', description: 'TESCO', amount: -4530, balance: null } });
  });

  it('combines debit/credit columns into a signed amount', () => {
    const map = { date: 'Date', description: 'Details', debit: 'Out', credit: 'In' };
    expect(normalizeRow({ Date: '2026-06-01', Details: 'Rent', Out: '1450.00', In: '' }, map)).toMatchObject({ ok: true, row: { amount: -145000 } });
    expect(normalizeRow({ Date: '2026-06-25', Details: 'Salary', Out: '', In: '3900.00' }, map)).toMatchObject({ ok: true, row: { amount: 390000 } });
  });

  it('fails a row with an unparseable date', () => {
    const r = normalizeRow({ Date: 'garbage', Amount: '10' }, { date: 'Date', amount: 'Amount' });
    expect(r.ok).toBe(false);
  });
});

describe('import.planDedupe', () => {
  const acct = 'acc-1';
  const row = (date: string, amount: number, description: string): ParsedRow => ({ date, description, amount, balance: null });

  it('drops a row already in the ledger (a statement re-import)', () => {
    const r = row('2026-08-01', -250, 'COFFEE');
    const existing = new Set([dedupeKey(acct, r.date, r.amount, r.description)]);
    const plan = planDedupe(acct, [r], existing);
    expect(plan.toInsert).toHaveLength(0);
    expect(plan.skipped).toBe(1);
    expect(plan.possibleDuplicates).toBe(0);
  });

  it('KEEPS two identical rows within one file, flagging the repeat (does not drop it)', () => {
    const r = row('2026-08-01', -250, 'COFFEE'); // two £2.50 coffees, same day — both are real
    const plan = planDedupe(acct, [r, { ...r }], new Set());
    expect(plan.toInsert).toHaveLength(2); // regression guard: was 1 (second silently dropped)
    expect(plan.toInsert[0].possibleDuplicate).toBe(false);
    expect(plan.toInsert[1].possibleDuplicate).toBe(true);
    expect(plan.possibleDuplicates).toBe(1);
    expect(plan.skipped).toBe(0);
  });

  it('treats rows differing in any identity field as distinct', () => {
    const rows = [row('2026-08-01', -250, 'COFFEE'), row('2026-08-01', -300, 'COFFEE'), row('2026-08-02', -250, 'COFFEE')];
    const plan = planDedupe(acct, rows, new Set());
    expect(plan.toInsert).toHaveLength(3);
    expect(plan.possibleDuplicates).toBe(0);
  });
});

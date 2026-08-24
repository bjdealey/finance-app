import { describe, it, expect } from 'vitest';
import { ungroundedFigures, redactUngrounded } from './validate';

describe('ungroundedFigures', () => {
  const tools = [
    JSON.stringify({ surplus: '£1,234.56', rate: '4.75%' }),
    JSON.stringify({ projectedBalance: '£6,400.00' }),
  ];

  it('passes figures quoted verbatim from a tool result', () => {
    expect(ungroundedFigures('You have £1,234.56 of surplus.', tools)).toEqual([]);
  });

  it('passes a pounds-only quote of a tool figure that had pence', () => {
    expect(ungroundedFigures('Your projected balance is about £6,400.', tools)).toEqual([]);
  });

  it('flags a money figure that never appears in any tool output', () => {
    expect(ungroundedFigures('You could save £9,999 next year.', tools)).toEqual(['£9,999']);
  });

  it('flags every money figure when no tools were called', () => {
    expect(ungroundedFigures('You have about £500 spare.', [])).toEqual(['£500']);
  });

  it('passes a percentage that appears in a tool output', () => {
    expect(ungroundedFigures('That account pays 4.75%.', tools)).toEqual([]);
  });

  it('flags a percentage/rate the model invented', () => {
    expect(ungroundedFigures('Your savings rate is 22% this month.', tools)).toEqual(['22%']);
  });

  it('does not let a money figure ground a same-valued percentage', () => {
    // corpus has £1,234.56 but no "1234%" — a "1,234%" claim must still be flagged.
    expect(ungroundedFigures('An absurd 1,234% return.', tools)).toEqual(['1,234%']);
  });

  it('ignores bare counts and durations (no £ or %)', () => {
    expect(ungroundedFigures('Over the next 30 days across 3 accounts.', tools)).toEqual([]);
  });
});

describe('redactUngrounded (fail closed)', () => {
  const tools = [JSON.stringify({ surplus: '£1,234.56', rate: '4.75%' })];

  it('leaves a grounded answer untouched', () => {
    const r = redactUngrounded('You have £1,234.56 at 4.75%.', tools);
    expect(r.removed).toEqual([]);
    expect(r.text).toBe('You have £1,234.56 at 4.75%.');
  });

  it('replaces an invented figure with [unverified] instead of showing it', () => {
    const r = redactUngrounded('You could save £9,999 at 8%.', tools);
    expect(r.removed).toEqual(['£9,999', '8%']);
    expect(r.text).toBe('You could save [unverified] at [unverified].');
  });

  it('redacts by whole token — a grounded figure containing an ungrounded substring survives', () => {
    const t = [JSON.stringify({ a: '£19,999.00' })];
    const r = redactUngrounded('Save £9,999 not £19,999.', t);
    expect(r.removed).toEqual(['£9,999']);
    expect(r.text).toBe('Save [unverified] not £19,999.');
  });
});

import { describe, it, expect } from 'vitest';
import { ungroundedFigures } from './validate';

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

  it('flags a figure that never appears in any tool output', () => {
    expect(ungroundedFigures('You could save £9,999 next year.', tools)).toEqual(['£9,999']);
  });

  it('flags every money figure when no tools were called', () => {
    expect(ungroundedFigures('You have about £500 spare.', [])).toEqual(['£500']);
  });

  it('ignores non-money numbers like percentages', () => {
    expect(ungroundedFigures('Your savings rate is 22% this month.', tools)).toEqual([]);
  });
});

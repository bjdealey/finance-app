import { describe, it, expect } from 'vitest';
import { hitRateLimit, clearRateLimit, RATE_LIMIT_MAX } from './rate-limit';

describe('login rate limiter', () => {
  it('blocks only after MAX attempts within the window', () => {
    const key = 'a@example.com';
    for (let i = 0; i < RATE_LIMIT_MAX; i++) expect(hitRateLimit(key)).toBe(false);
    expect(hitRateLimit(key)).toBe(true); // MAX+1 → blocked
  });

  it('resets after a successful login (clear)', () => {
    const key = 'b@example.com';
    for (let i = 0; i < RATE_LIMIT_MAX + 2; i++) hitRateLimit(key);
    clearRateLimit(key);
    expect(hitRateLimit(key)).toBe(false);
  });

  it('starts a fresh window once WINDOW_MS has elapsed', () => {
    const key = 'c@example.com';
    const t0 = 1_000_000;
    for (let i = 0; i < RATE_LIMIT_MAX + 1; i++) hitRateLimit(key, t0);
    // 16 minutes later → new window, not blocked.
    expect(hitRateLimit(key, t0 + 16 * 60_000)).toBe(false);
  });
});

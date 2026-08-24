import { describe, it, expect } from 'vitest';
import { hitRateLimit, clearRateLimit, RATE_LIMIT_MAX, clientIpFrom } from './rate-limit';

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

  it('throttles registration probes per IP even as the email is rotated', () => {
    const ip = 'register:203.0.113.9';
    // Each probe uses a different email but the same source IP → the IP key is what caps it.
    for (let i = 0; i < RATE_LIMIT_MAX; i++) expect(hitRateLimit(ip)).toBe(false);
    expect(hitRateLimit(ip)).toBe(true);
  });

  it('caps a password-spray across many emails from one IP (login checks the IP key too)', () => {
    const ipKey = 'login-ip:198.51.100.23';
    // Mirrors loginAction: check the IP key, then the per-email key. Each attempt uses a fresh email,
    // so the email keys stay cold — only the shared IP key accumulates and trips.
    const attempt = (email: string) => hitRateLimit(ipKey) || hitRateLimit(email);
    for (let i = 0; i < RATE_LIMIT_MAX; i++) expect(attempt(`spray${i}@example.com`)).toBe(false);
    expect(attempt('spray-final@example.com')).toBe(true); // IP key trips even though every email is new
  });
});

describe('clientIpFrom', () => {
  const from = (h: Record<string, string>) => clientIpFrom((n) => h[n] ?? null);

  it('takes the first x-forwarded-for hop', () => {
    expect(from({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' })).toBe('203.0.113.7');
  });

  it('falls back to x-real-ip when there is no forwarded-for', () => {
    expect(from({ 'x-real-ip': '198.51.100.9' })).toBe('198.51.100.9');
  });

  it('falls back to a constant when no proxy headers are present', () => {
    expect(from({})).toBe('local');
  });
});

// Fixed-window auth throttle. Records one attempt per call and reports whether the key has exceeded
// MAX within WINDOW_MS. Login keys by email (call clearRateLimit() on success); registration keys by
// `register:<ip>` to cap account-enumeration probes from one source (enumeration rotates the email,
// so an email key wouldn't fire — the source is the limit).
//
// ponytail: per-process, in-memory. For production add a CAPTCHA and move the store to Redis/DB if you
// run more than one instance (this Map is not shared across processes).

const WINDOW_MS = 15 * 60_000; // 15 minutes
const MAX_ATTEMPTS = 8;

const hits = new Map<string, { count: number; windowStart: number }>();

/** Record an attempt for `key`; returns true if it is now over the limit (should be blocked). */
export function hitRateLimit(key: string, now: number = Date.now()): boolean {
  const rec = hits.get(key);
  if (!rec || now - rec.windowStart > WINDOW_MS) {
    hits.set(key, { count: 1, windowStart: now });
    return false;
  }
  rec.count += 1;
  return rec.count > MAX_ATTEMPTS;
}

/** Clear the counter for `key` (call after a successful login). */
export function clearRateLimit(key: string): void {
  hits.delete(key);
}

export const RATE_LIMIT_MAX = MAX_ATTEMPTS;

// Client IP for throttle keys, from proxy headers (first x-forwarded-for hop, then x-real-ip).
// ponytail: x-forwarded-for is client-settable unless a trusted proxy overwrites it, so a determined
// attacker can spoof it to rotate the key. Behind a real proxy in production, trust only the
// proxy-set header. Still stops naive enumeration and is far better than no throttle.
export function clientIpFrom(get: (name: string) => string | null): string {
  const first = get('x-forwarded-for')?.split(',')[0]?.trim();
  if (first) return first;
  return get('x-real-ip')?.trim() || 'local';
}

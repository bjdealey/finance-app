// Fixed-window login throttle. Records one attempt per call and reports whether the key has
// exceeded MAX within WINDOW_MS. A successful login should call clearRateLimit() to reset.
//
// ponytail: per-process, in-memory, keyed by email — enough to stop password brute-forcing on a
// single instance. For production add IP-based limiting + a CAPTCHA, and move the store to Redis/DB
// if you run more than one instance (this Map is not shared across processes).

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

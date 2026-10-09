/**
 * Best-effort in-process rate limiting. Fluid Compute reuses instances so this
 * catches the common case of one client hammering an endpoint; the durable
 * limits that actually matter are enforced in the database.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

/** Counts this call and says whether it is still within `limit`. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  if (isLimited(key, limit)) return false;
  countHit(key, windowMs);
  return true;
}

/** Whether `key` has used up `limit`, without counting this call. */
export function isLimited(key: string, limit: number): boolean {
  const bucket = buckets.get(key);
  return Boolean(bucket && bucket.resetAt >= Date.now() && bucket.count >= limit);
}

/**
 * Counts one use of `key`. Paired with `isLimited` when only some outcomes
 * should count, e.g. failed logins but not successful ones.
 */
export function countHit(key: string, windowMs: number): void {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
  } else {
    bucket.count += 1;
  }
}

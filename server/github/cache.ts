/*
 * A small in-memory cache with three jobs, all of which exist to keep us well
 * inside GitHub's 5,000 points/hour budget:
 *
 *   1. TTL caching, so repeated visits don't each cost an API call.
 *   2. In-flight de-duplication, so a burst of concurrent requests for the same
 *      key produces exactly one upstream call.
 *   3. Stale fallback — if a refresh fails (rate limit, GitHub outage), we keep
 *      serving the last good value rather than showing the visitor an error.
 *
 * Scope is one server instance. On serverless that means one warm container,
 * which is precisely the case worth optimising; the CDN `Cache-Control` headers
 * set in the router handle everything colder than that.
 */

interface CacheEntry<T> {
  value: T;
  /** Epoch ms after which the value should be refreshed. */
  expiresAt: number;
}

const STALE_GRACE_MS = 24 * 60 * 60 * 1000;

const entries = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

export interface CachedResult<T> {
  value: T;
  /** True when the refresh failed and this is the previous good value. */
  stale: boolean;
}

export async function cached<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
): Promise<CachedResult<T>> {
  const now = Date.now();
  const entry = entries.get(key) as CacheEntry<T> | undefined;

  if (entry && entry.expiresAt > now) {
    return { value: entry.value, stale: false };
  }

  const existing = inFlight.get(key) as Promise<T> | undefined;
  if (existing) {
    return { value: await existing, stale: false };
  }

  const pending = load()
    .then((value) => {
      entries.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, pending);

  try {
    return { value: await pending, stale: false };
  } catch (error) {
    // Serve the last good value rather than a broken section, but only while
    // it is recent enough to still be truthful.
    if (entry && entry.expiresAt + STALE_GRACE_MS > now) {
      return { value: entry.value, stale: true };
    }
    throw error;
  }
}

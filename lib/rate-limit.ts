/**
 * Simple in-memory rate limiter (fixed window per key).
 *
 * NOTE: state is per-process. Behind multiple instances/pods this limits each
 * instance independently — good enough as a first line of defense, but move to
 * a shared store (e.g. Redis) for strict cross-instance limits.
 */
type Bucket = { count: number; resetAt: number }

const store = new Map<string, Bucket>()

export interface RateLimitResult {
  allowed: boolean
  retryAfterSeconds: number
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const bucket = store.get(key)

  if (!bucket || now > bucket.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfterSeconds: 0 }
  }

  if (bucket.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) }
  }

  bucket.count++
  return { allowed: true, retryAfterSeconds: 0 }
}

/** Best-effort client IP from proxy headers. */
export function clientIp(request: Request): string {
  const h = request.headers
  return (
    h.get('x-forwarded-for')?.split(',')[0].trim() ||
    h.get('x-real-ip') ||
    'unknown'
  )
}

// Occasionally evict expired buckets so the map doesn't grow unbounded.
setInterval(() => {
  const now = Date.now()
  for (const [k, b] of store) if (now > b.resetAt) store.delete(k)
}, 5 * 60_000).unref?.()

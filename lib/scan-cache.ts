/**
 * Client-side scan BYTE cache.
 *
 * Scans (GLB / STL / PLY) are large (up to ~18 MB each, ~100 MB for a full
 * case) and are served via *presigned* S3 GET URLs whose query string
 * (`X-Amz-Signature`, `X-Amz-Date`, `X-Amz-Expires` …) rotates on every case
 * load. The browser HTTP cache keys on the full URL including that query, so it
 * never hits — the same scan re-downloads from S3 on every revisit.
 *
 * We cache the raw bytes keyed by the STABLE S3 object path (query string
 * stripped), so revisits are served locally without touching the URL-signing
 * scheme. Two tiers:
 *   - tier 1: in-memory LRU  — instant within the tab session
 *   - tier 2: Cache Storage  — survives reloads / cross-visit (best-effort;
 *                              the browser may evict under storage pressure)
 *
 * Only immutable content is cached: a replaced scan is a NEW S3 key, so the
 * key-based cache naturally misses and re-downloads. Never key on the signed
 * URL. Comments/annotations are fetched separately and are unaffected.
 *
 * Browser-only module — safe to import from a 'use client' component.
 */

const CACHE_NAME = 'jdlab-scan-bytes-v2'

// Tunable caps. The in-memory byte tier is kept small on purpose — the parsed
// scene cache (in ScanViewer) is the within-session workhorse; this tier mainly
// bridges a parsed-cache eviction, and the disk tier handles persistence.
const MAX_MEM_ENTRIES = 4
const MAX_MEM_BYTES = 96 * 1024 * 1024
const MAX_DISK_ENTRIES = 24 // bounds Cache Storage growth (~a few cases)

/**
 * Stable identity for a scan: the URL path (the S3 object key) with the
 * rotating presigned query params removed. Falls back to the pre-`?` string if
 * it isn't a parseable URL.
 */
export function scanCacheKey(url: string): string {
  try {
    const u = new URL(url, 'https://scan.local')
    return u.origin + u.pathname
  } catch {
    return url.split('?')[0]
  }
}

// --- tier 1: in-memory LRU (insertion order = recency) ---------------------
const mem = new Map<string, ArrayBuffer>()
let memBytes = 0

function memGet(key: string): ArrayBuffer | undefined {
  const buf = mem.get(key)
  if (buf) {
    mem.delete(key)
    mem.set(key, buf) // bump to most-recently-used
  }
  return buf
}

function memPut(key: string, buf: ArrayBuffer): void {
  const existing = mem.get(key)
  if (existing) {
    memBytes -= existing.byteLength
    mem.delete(key)
  }
  mem.set(key, buf)
  memBytes += buf.byteLength
  while (mem.size > MAX_MEM_ENTRIES || memBytes > MAX_MEM_BYTES) {
    const oldest = mem.keys().next().value as string | undefined
    if (oldest === undefined) break
    memBytes -= mem.get(oldest)?.byteLength ?? 0
    mem.delete(oldest)
  }
}

// --- tier 2: Cache Storage (disk, cross-session, best-effort) --------------
function diskEnabled(): boolean {
  return (
    typeof caches !== 'undefined' &&
    typeof window !== 'undefined' &&
    window.isSecureContext
  )
}

// Synthetic same-shape request key; never actually hits the network.
function diskReq(key: string): string {
  return `https://scan-cache.local/${encodeURIComponent(key)}`
}

async function diskGet(key: string): Promise<ArrayBuffer | null> {
  if (!diskEnabled()) return null
  try {
    const cache = await caches.open(CACHE_NAME)
    const res = await cache.match(diskReq(key))
    return res ? await res.arrayBuffer() : null
  } catch {
    return null
  }
}

async function diskPut(key: string, buf: ArrayBuffer): Promise<void> {
  if (!diskEnabled()) return
  try {
    const cache = await caches.open(CACHE_NAME)
    await cache.put(diskReq(key), new Response(buf))
    // Cache Storage `.keys()` is insertion-ordered → evict the oldest overflow.
    const keys = await cache.keys()
    for (let i = 0; i < keys.length - MAX_DISK_ENTRIES; i++) {
      await cache.delete(keys[i])
    }
  } catch {
    // Quota exceeded / private mode / disabled — caching is best-effort.
  }
}

/** Look up cached scan bytes by stable key (memory first, then disk). */
export async function getScanBytes(key: string): Promise<ArrayBuffer | null> {
  const hit = memGet(key)
  if (hit) return hit
  const disk = await diskGet(key)
  if (disk) {
    memPut(key, disk)
    return disk
  }
  return null
}

/** Store scan bytes under a stable key (memory + best-effort disk). */
export async function putScanBytes(key: string, buf: ArrayBuffer): Promise<void> {
  memPut(key, buf)
  await diskPut(key, buf)
}

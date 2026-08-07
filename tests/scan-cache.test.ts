import { describe, it, expect } from 'vitest'
import { scanCacheKey, getScanBytes, putScanBytes } from '../lib/scan-cache'

// The crux of the scan cache: presigned S3 GET URLs carry a rotating query
// string (X-Amz-Signature/Date/Expires) that changes on every case load, which
// defeats the browser HTTP cache. scanCacheKey must collapse those variants to
// ONE stable identity (the S3 object path) so revisits hit the cache.
describe('scanCacheKey', () => {
  const base =
    'https://bucket.s3.us-east-1.amazonaws.com/case-attachments/cases/41/abc-scan.glb'

  it('strips the rotating presigned query so two signatures of one object match', () => {
    const url1 = `${base}?X-Amz-Date=20260101T000000Z&X-Amz-Signature=AAA&X-Amz-Expires=900`
    const url2 = `${base}?X-Amz-Date=20260102T120000Z&X-Amz-Signature=BBB&X-Amz-Expires=900`
    expect(scanCacheKey(url1)).toBe(scanCacheKey(url2))
    expect(scanCacheKey(url1)).toBe(base)
  })

  it('never keeps the query string in the key', () => {
    expect(scanCacheKey(`${base}?X-Amz-Signature=ZZZ`)).not.toContain('?')
  })

  it('gives different objects different keys', () => {
    const a = 'https://b.s3.amazonaws.com/cases/1/a.glb?X-Amz-Signature=Z'
    const b = 'https://b.s3.amazonaws.com/cases/1/b.glb?X-Amz-Signature=Z'
    expect(scanCacheKey(a)).not.toBe(scanCacheKey(b))
  })

  it('is stable (idempotent) for a URL with no query string', () => {
    expect(scanCacheKey(base)).toBe(base)
  })

  it('returns a string and does not throw on odd inputs', () => {
    expect(typeof scanCacheKey('blob:https://x/abc-123')).toBe('string')
    expect(typeof scanCacheKey('cases/1/a.glb?sig=1')).toBe('string')
  })
})

// In a node (vitest) env there is no Cache Storage, so the disk tier is a safe
// no-op and these exercise the in-memory LRU tier. Keys are randomized so tests
// don't collide via the module-level cache.
describe('scan byte cache (in-memory tier)', () => {
  it('round-trips bytes through the cache', async () => {
    const key = `rt-${Math.random()}`
    const buf = new TextEncoder().encode('hello-scan').buffer
    await putScanBytes(key, buf)
    const got = await getScanBytes(key)
    expect(got).not.toBeNull()
    expect(new Uint8Array(got!)).toEqual(new Uint8Array(buf))
  })

  it('returns null for an unknown key', async () => {
    expect(await getScanBytes(`missing-${Math.random()}`)).toBeNull()
  })

  it('evicts the oldest entries once the cap is exceeded (LRU)', async () => {
    // Insert well beyond the in-memory cap of fresh, unique keys; only the most
    // recently inserted survive, so the first is evicted and the last is kept.
    const keys = Array.from({ length: 12 }, (_, i) => `lru-${Math.random()}-${i}`)
    for (const k of keys) await putScanBytes(k, new Uint8Array([1, 2, 3]).buffer)
    expect(await getScanBytes(keys[0])).toBeNull() // oldest → evicted
    expect(await getScanBytes(keys[keys.length - 1])).not.toBeNull() // newest → kept
  })
})

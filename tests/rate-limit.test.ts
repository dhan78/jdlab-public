import { describe, it, expect } from 'vitest'
import { rateLimit } from '../lib/rate-limit'

describe('rate-limit', () => {
  it('allows up to the limit, then blocks', () => {
    const key = `test-${Math.random()}`
    for (let i = 0; i < 3; i++) {
      expect(rateLimit(key, 3, 1000).allowed).toBe(true)
    }
    const blocked = rateLimit(key, 3, 1000)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('resets after the window elapses', async () => {
    const key = `test-${Math.random()}`
    expect(rateLimit(key, 1, 50).allowed).toBe(true)
    expect(rateLimit(key, 1, 50).allowed).toBe(false)
    await new Promise(r => setTimeout(r, 70))
    expect(rateLimit(key, 1, 50).allowed).toBe(true)
  })

  it('tracks keys independently', () => {
    const a = `a-${Math.random()}`
    const b = `b-${Math.random()}`
    expect(rateLimit(a, 1, 1000).allowed).toBe(true)
    expect(rateLimit(a, 1, 1000).allowed).toBe(false)
    expect(rateLimit(b, 1, 1000).allowed).toBe(true)
  })
})

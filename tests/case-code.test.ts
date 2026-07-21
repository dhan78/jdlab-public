import { describe, it, expect } from 'vitest'
import { encodeCaseId, decodeCaseId } from '../lib/case-code'

describe('case-code', () => {
  it('round-trips ids 1..5000', () => {
    for (let i = 1; i <= 5000; i++) {
      expect(decodeCaseId(encodeCaseId(i))).toBe(i)
    }
  })

  it('produces distinct 7-char uppercase base32 tokens', () => {
    const token = encodeCaseId(3)
    expect(token).toHaveLength(7)
    expect(token).toMatch(/^[0-9A-HJKMNP-TV-Z]{7}$/)
    expect(encodeCaseId(1)).not.toBe(encodeCaseId(2))
  })

  it('is deterministic', () => {
    expect(encodeCaseId(42)).toBe(encodeCaseId(42))
  })

  it('rejects malformed tokens', () => {
    expect(decodeCaseId('abc')).toBe(-1) // wrong length
    expect(decodeCaseId('1-2')).toBe(-1) // invalid char
    expect(decodeCaseId('TOOLONGTOKEN')).toBe(-1)
    expect(decodeCaseId('')).toBe(-1)
  })
})

import { describe, it, expect } from 'vitest'
import { checkIngestToken } from '../lib/ingest-token'

const TOKEN = 'super-secret-ingest-token'

describe('checkIngestToken', () => {
  it('returns ok on an exact Bearer match', () => {
    expect(checkIngestToken(TOKEN, `Bearer ${TOKEN}`)).toBe('ok')
  })

  it('returns not_configured when the server has no token', () => {
    expect(checkIngestToken(undefined, `Bearer ${TOKEN}`)).toBe('not_configured')
    expect(checkIngestToken('', `Bearer ${TOKEN}`)).toBe('not_configured')
    expect(checkIngestToken(null, `Bearer ${TOKEN}`)).toBe('not_configured')
  })

  it('returns invalid on a wrong token', () => {
    expect(checkIngestToken(TOKEN, 'Bearer nope')).toBe('invalid')
  })

  it('returns invalid when the header is missing or malformed', () => {
    expect(checkIngestToken(TOKEN, null)).toBe('invalid')
    expect(checkIngestToken(TOKEN, undefined)).toBe('invalid')
    expect(checkIngestToken(TOKEN, TOKEN)).toBe('invalid') // no "Bearer " prefix
    expect(checkIngestToken(TOKEN, 'Basic abc')).toBe('invalid')
  })

  it('returns invalid on a length mismatch (prefix of the real token)', () => {
    expect(checkIngestToken(TOKEN, `Bearer ${TOKEN.slice(0, -1)}`)).toBe('invalid')
    expect(checkIngestToken(TOKEN, `Bearer ${TOKEN}extra`)).toBe('invalid')
  })
})

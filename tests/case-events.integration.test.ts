import { config } from 'dotenv'
// Load DATABASE_URL (+ friends) before we dynamically import lib/case-events,
// which pulls in the pg pool. Static imports are hoisted, so this runs first
// relative to the *dynamic* import in beforeAll.
config({ path: '.env.local' })

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import type { CaseEvent } from '../lib/case-events'

const DATABASE_URL = process.env.DATABASE_URL

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

/**
 * pg_notify only reaches connections that are already LISTENing, and the
 * module's LISTEN connection establishes asynchronously. So we re-emit on a
 * short interval until the event is observed (or we time out) — the emit is
 * idempotent for our assertions.
 */
async function pollEmitUntil(cond: () => boolean, emit: () => void, timeoutMs = 8000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    emit()
    await delay(150)
    if (cond()) return
  }
}

// Loaded in beforeAll once we've confirmed a DB is reachable.
let events: typeof import('../lib/case-events')
let dbAvailable = false

describe('SSE event fan-out (Postgres LISTEN/NOTIFY)', () => {
  beforeAll(async () => {
    if (!DATABASE_URL) return
    // Fail fast (and skip) if no DB is reachable — e.g. CI without Postgres.
    try {
      const probe = new Client({ connectionString: DATABASE_URL, connectionTimeoutMillis: 2000 })
      await probe.connect()
      await probe.end()
      dbAvailable = true
      events = await import('../lib/case-events')
    } catch {
      dbAvailable = false
    }
  })

  it('delivers an emitted update to a local subscriber (with doctorId for scoping)', async ctx => {
    if (!dbAvailable) return ctx.skip()
    const received: CaseEvent[] = []
    const unsub = events.onCaseEvents(e => received.push(e))
    const token = `EVT-${Date.now()}`
    try {
      await pollEmitUntil(
        () => received.some(e => e.caseId === token),
        () => events.emitCaseUpdate(token, '7')
      )
    } finally {
      unsub()
    }
    const hit = received.find(e => e.caseId === token)
    expect(hit).toBeTruthy()
    expect(hit?.event).toBe('update')
    // doctorId rides along for server-side scoping and must survive the round-trip.
    expect(hit?.doctorId).toBe('7')
  })

  it('fans one NOTIFY out to every local subscriber (multiple SSE streams)', async ctx => {
    if (!dbAvailable) return ctx.skip()
    const a: CaseEvent[] = []
    const b: CaseEvent[] = []
    const un1 = events.onCaseEvents(e => a.push(e))
    const un2 = events.onCaseEvents(e => b.push(e))
    const token = `FAN-${Date.now()}`
    try {
      await pollEmitUntil(
        () => a.some(e => e.caseId === token) && b.some(e => e.caseId === token),
        () => events.emitCaseUpdate(token, '1')
      )
    } finally {
      un1()
      un2()
    }
    expect(a.some(e => e.caseId === token)).toBe(true)
    expect(b.some(e => e.caseId === token)).toBe(true)
  })

  it('delivers to an INDEPENDENT LISTEN connection (cross-instance fan-out)', async ctx => {
    if (!dbAvailable) return ctx.skip()
    // Simulate a second app instance: its own pg connection LISTENing on the
    // same channel. An event emitted on our connection must reach it.
    const listener = new Client({ connectionString: DATABASE_URL })
    const payloads: string[] = []
    await listener.connect()
    listener.on('notification', m => {
      if (m.channel === 'case_events' && m.payload) payloads.push(m.payload)
    })
    await listener.query('LISTEN case_events')

    const token = `XINST-${Date.now()}`
    try {
      await pollEmitUntil(
        () => payloads.some(p => p.includes(token)),
        () => events.emitCaseUpdate(token, '9')
      )
    } finally {
      await listener.end()
    }
    const parsed = payloads.map(p => JSON.parse(p) as CaseEvent).find(e => e.caseId === token)
    expect(parsed).toBeTruthy()
    expect(parsed?.event).toBe('update')
    expect(parsed?.doctorId).toBe('9')
  })

  it('carries typing events with their data payload', async ctx => {
    if (!dbAvailable) return ctx.skip()
    const got: CaseEvent[] = []
    const unsub = events.onCaseEvents(e => {
      if (e.event === 'typing') got.push(e)
    })
    const token = `TYP-${Date.now()}`
    try {
      await pollEmitUntil(
        () => got.some(e => e.caseId === token),
        () => events.emitCaseTyping(token, '3', { userId: '3', name: 'Dr. Test' })
      )
    } finally {
      unsub()
    }
    const hit = got.find(e => e.caseId === token)
    expect(hit).toBeTruthy()
    expect(hit?.data).toMatchObject({ userId: '3', name: 'Dr. Test' })
  })

  it('stops delivering after unsubscribe', async ctx => {
    if (!dbAvailable) return ctx.skip()
    const got: CaseEvent[] = []
    const unsub = events.onCaseEvents(e => got.push(e))
    // First, confirm the subscription is live (LISTEN connection established).
    const warmup = `UNS1-${Date.now()}`
    await pollEmitUntil(
      () => got.some(e => e.caseId === warmup),
      () => events.emitCaseUpdate(warmup, '1')
    )
    // Now unsubscribe and ensure a subsequent event is NOT delivered to us.
    unsub()
    const after = `UNS2-${Date.now()}`
    events.emitCaseUpdate(after, '1')
    await delay(700)
    expect(got.some(e => e.caseId === after)).toBe(false)
  })

  afterAll(async () => {
    // Give any in-flight NOTIFY handlers a tick to settle before teardown.
    await delay(50)
  })
})

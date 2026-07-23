import { EventEmitter } from 'node:events'
import { Client } from 'pg'
import { sql } from 'drizzle-orm'
import { db } from './db'

/**
 * Pub/sub for case activity, powering the single SSE stream (/api/portal/stream).
 *
 * Fan-out across app instances uses Postgres LISTEN/NOTIFY:
 *   - emit  -> pg_notify('case_events', json)
 *   - a dedicated LISTEN connection (one per process) receives EVERY notify
 *     (including this instance's own) and re-emits to a local EventEmitter,
 *     which is what the SSE streams subscribe to.
 * So all instances deliver uniformly: a message posted on instance A reaches a
 * stream held on instance B.
 *
 * The emitter and a "listener started" flag live on globalThis so they're
 * singletons across route bundles and survive dev HMR.
 */
const CHANNEL = 'case_events'

const globalForEvents = globalThis as unknown as {
  __caseEmitter?: EventEmitter
  __caseListenStarted?: boolean
}

const emitter =
  globalForEvents.__caseEmitter ??
  (() => {
    const e = new EventEmitter()
    e.setMaxListeners(0) // many concurrent streams may subscribe
    return e
  })()

globalForEvents.__caseEmitter = emitter

export type CaseEventName = 'update' | 'typing'

export interface CaseEvent {
  caseId: string
  /** Owning doctor id — used for server-side scoping; never sent to clients. */
  doctorId: string
  event: CaseEventName
  data?: unknown
}

// --- LISTEN side: one dedicated connection per process, re-emits locally ---
function startListener(): void {
  if (globalForEvents.__caseListenStarted) return
  const url = process.env.DATABASE_URL
  if (!url) return // build-time / misconfig: skip, retried on next call
  globalForEvents.__caseListenStarted = true

  let reconnecting = false
  const scheduleReconnect = () => {
    if (reconnecting) return
    reconnecting = true
    setTimeout(() => {
      reconnecting = false
      connect()
    }, 2000)
  }

  const connect = () => {
    const client = new Client({ connectionString: url })
    client.on('notification', msg => {
      if (msg.channel !== CHANNEL || !msg.payload) return
      try {
        emitter.emit(CHANNEL, JSON.parse(msg.payload) as CaseEvent)
      } catch {
        /* ignore malformed payload */
      }
    })
    client.on('error', () => {
      client.end().catch(() => {})
      scheduleReconnect()
    })
    client.on('end', scheduleReconnect)
    client
      .connect()
      .then(() => client.query(`LISTEN ${CHANNEL}`))
      .catch(() => {
        client.end().catch(() => {})
        scheduleReconnect()
      })
  }

  connect()
}

// --- NOTIFY side: publish to all instances ---
function publish(evt: CaseEvent): void {
  startListener()
  void db.execute(sql`select pg_notify(${CHANNEL}, ${JSON.stringify(evt)})`).catch(() => {
    // Best-effort fallback: if NOTIFY fails, emit locally so a single instance
    // still delivers to its own open streams.
    emitter.emit(CHANNEL, evt)
  })
}

/** Signal a case changed (new message / status) so streams refetch. */
export function emitCaseUpdate(caseId: string, doctorId: string): void {
  publish({ caseId, doctorId, event: 'update' })
}

/** Signal that a user is typing in a case. */
export function emitCaseTyping(
  caseId: string,
  doctorId: string,
  data: { userId: string; name: string }
): void {
  publish({ caseId, doctorId, event: 'typing', data })
}

/** Subscribe to all case events (used by the SSE stream). */
export function onCaseEvents(listener: (e: CaseEvent) => void): () => void {
  startListener() // ensure the LISTEN connection is up while streams are open
  emitter.on(CHANNEL, listener)
  return () => emitter.off(CHANNEL, listener)
}

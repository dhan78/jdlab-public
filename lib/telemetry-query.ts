/**
 * Read side of the telemetry pipeline, used by the admin Session Timeline
 * viewer. In local dev it reads the NDJSON produced by lib/telemetry-sink.ts's
 * fallback. In production this module is the single place to swap in an Athena
 * (S3) query — the API/UI talk only to these functions, so the backend can
 * change without touching them.
 *
 * Admin-only data (enforced by the route). Contains no message/patient text —
 * only interaction metadata (see lib/telemetry.ts).
 */
import { promises as fs } from 'fs'

const DEV_FILE = process.env.TELEMETRY_DEV_FILE ?? 'telemetry-dev.ndjson'

export interface TelemetryRecord {
  sid: string | null
  ev: string
  client_t: number | null
  url: string | null
  props?: Record<string, unknown>
  uid: string | null
  role: string | null
  ingest_t: number
  ip: string | null
  ua: string | null
}

export interface ActiveUser {
  uid: string
  role: string | null
  lastT: number | null
  sessions: number
  events: number
}

export interface SessionSummary {
  sid: string
  startT: number | null
  endT: number | null
  count: number
  ua: string | null
  viewport?: { w?: number; h?: number }
}

/** True when running against the local dev NDJSON (no Firehose/Athena). */
export function isDevTelemetrySource(): boolean {
  return !process.env.TELEMETRY_FIREHOSE_STREAM
}

function eventTime(r: TelemetryRecord): number {
  return typeof r.client_t === 'number' ? r.client_t : r.ingest_t
}

// DEV source. Replace with an Athena query (date-partitioned, WHERE uid=…) in
// production so the viewer scans a small slice, not the whole dataset.
async function readAll(): Promise<TelemetryRecord[]> {
  try {
    const raw = await fs.readFile(DEV_FILE, 'utf8')
    const out: TelemetryRecord[] = []
    for (const line of raw.split('\n')) {
      const s = line.trim()
      if (!s) continue
      try {
        out.push(JSON.parse(s) as TelemetryRecord)
      } catch {
        /* skip malformed line */
      }
    }
    return out
  } catch {
    return []
  }
}

export async function listActiveUsers(): Promise<ActiveUser[]> {
  const all = await readAll()
  const byUid = new Map<string, { role: string | null; last: number; sids: Set<string>; count: number }>()
  for (const r of all) {
    if (!r.uid) continue
    const e = byUid.get(r.uid) ?? { role: r.role, last: 0, sids: new Set<string>(), count: 0 }
    if (!e.role) e.role = r.role
    const t = eventTime(r)
    if (t > e.last) e.last = t
    if (r.sid) e.sids.add(r.sid)
    e.count++
    byUid.set(r.uid, e)
  }
  return [...byUid.entries()]
    .map(([uid, e]) => ({ uid, role: e.role, lastT: e.last || null, sessions: e.sids.size, events: e.count }))
    .sort((a, b) => (b.lastT ?? 0) - (a.lastT ?? 0))
}

export async function listSessions(uid: string): Promise<SessionSummary[]> {
  const all = await readAll()
  const bySid = new Map<string, TelemetryRecord[]>()
  for (const r of all) {
    if (r.uid !== uid || !r.sid) continue
    if (!bySid.has(r.sid)) bySid.set(r.sid, [])
    bySid.get(r.sid)!.push(r)
  }
  const sessions: SessionSummary[] = []
  for (const [sid, evs] of bySid) {
    const times = evs.map(eventTime)
    const start = evs.find(e => e.ev === 'session_start')
    const vp = start?.props
    sessions.push({
      sid,
      startT: times.length ? Math.min(...times) : null,
      endT: times.length ? Math.max(...times) : null,
      count: evs.length,
      ua: start?.ua ?? evs[0]?.ua ?? null,
      viewport: vp ? { w: vp.w as number | undefined, h: vp.h as number | undefined } : undefined,
    })
  }
  return sessions.sort((a, b) => (b.startT ?? 0) - (a.startT ?? 0))
}

export async function getSessionEvents(uid: string, sid: string): Promise<TelemetryRecord[]> {
  const all = await readAll()
  return all.filter(r => r.uid === uid && r.sid === sid).sort((a, b) => eventTime(a) - eventTime(b))
}

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
import {
  AthenaClient,
  StartQueryExecutionCommand,
  GetQueryExecutionCommand,
  GetQueryResultsCommand,
} from '@aws-sdk/client-athena'

const DEV_FILE = process.env.TELEMETRY_DEV_FILE ?? 'telemetry-dev.ndjson'

// Athena (prod read source) config — mirrors the runbook env in
// deploy/telemetry-firehose-athena-setup.md §6. Identifiers come from trusted
// server env (never user input), so they're safe to interpolate into SQL.
const REGION = process.env.AWS_REGION ?? 'us-east-1'
const ATHENA_DB = process.env.ATHENA_DATABASE ?? 'jdlab'
const ATHENA_TABLE = process.env.ATHENA_TABLE ?? 'telemetry'
const ATHENA_WORKGROUP = process.env.ATHENA_WORKGROUP ?? 'jdlab'
const ATHENA_OUTPUT = process.env.ATHENA_OUTPUT // optional if the workgroup sets one
// Bound every scan to a recent window so partition projection prunes to a few
// days of Parquet (cents-free at this scale). Tunable via env.
const LOOKBACK_DAYS = Number(process.env.TELEMETRY_LOOKBACK_DAYS ?? '7')


export interface TelemetryRecord {
  sid: string | null
  ev: string
  kind?: string | null
  req_id?: string | null
  message?: string | null
  name?: string | null
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

// On the delivery path `props` is serialized to a JSON string (Glue `props string`
// column), so a record read back from Athena/Parquet carries `props` as a string.
// Normalize it back to an object so consumers (viewer, session viewport) are agnostic
// to which source produced the record. Dev NDJSON already stores objects — passthrough.
function normalizeRecord(r: TelemetryRecord): TelemetryRecord {
  if (typeof (r as { props?: unknown }).props === 'string') {
    try {
      r.props = JSON.parse((r as unknown as { props: string }).props)
    } catch {
      r.props = undefined
    }
  }
  return r
}

// DEV source. Replace with an Athena query (date-partitioned, WHERE uid=…) in
// production so the viewer scans a small slice, not the whole dataset.
async function readAll(): Promise<TelemetryRecord[]> {
  // Prod: same gate as the write side (lib/telemetry-sink.ts). When Firehose is
  // configured, records live in S3/Parquet — read them back via Athena.
  if (!isDevTelemetrySource()) {
    try {
      const since = `date_format(current_date - interval '${LOOKBACK_DAYS}' day, '%Y-%m-%d')`
      return await queryAthena(`SELECT * FROM ${ATHENA_DB}.${ATHENA_TABLE} WHERE dt >= ${since}`)
    } catch (err) {
      // Never surface Athena failures to the admin UI — just return empty.
      console.error('[telemetry] athena read failed:', (err as Error).message)
      return []
    }
  }

  // Dev: read the local NDJSON produced by the sink's fallback.
  try {
    const raw = await fs.readFile(DEV_FILE, 'utf8')
    const out: TelemetryRecord[] = []
    for (const line of raw.split('\n')) {
      const s = line.trim()
      if (!s) continue
      try {
        out.push(normalizeRecord(JSON.parse(s) as TelemetryRecord))
      } catch {
        /* skip malformed line */
      }
    }
    return out
  } catch {
    return []
  }
}

// ---- Athena (prod) ---------------------------------------------------------

let _athena: AthenaClient | null = null
function athena(): AthenaClient {
  if (!_athena) _athena = new AthenaClient({ region: REGION })
  return _athena
}

// Athena returns every column as a VarCharValue string; coerce the numeric Glue
// columns back to numbers so consumers (eventTime, viewport) behave as they do
// with dev JSON. Unknown/absent values become null.
function coerceCell(v: string | undefined, type: string | undefined): unknown {
  if (v == null) return null
  switch (type) {
    case 'bigint':
    case 'integer':
    case 'int':
    case 'tinyint':
    case 'smallint': {
      const n = Number(v)
      return Number.isFinite(n) ? n : null
    }
    default:
      return v
  }
}

/**
 * Run a read-only SQL query against Athena and map the result rows into
 * TelemetryRecords. Starts the query, polls to completion, then pages through
 * the results. `props` (a JSON string column) is parsed back to an object by
 * normalizeRecord, so rows are shape-identical to the dev NDJSON path.
 */
async function queryAthena(sql: string): Promise<TelemetryRecord[]> {
  const started = await athena().send(
    new StartQueryExecutionCommand({
      QueryString: sql,
      WorkGroup: ATHENA_WORKGROUP,
      QueryExecutionContext: { Database: ATHENA_DB },
      ...(ATHENA_OUTPUT ? { ResultConfiguration: { OutputLocation: ATHENA_OUTPUT } } : {}),
    })
  )
  const qid = started.QueryExecutionId
  if (!qid) throw new Error('Athena did not return a QueryExecutionId')

  // Poll to completion (~18s cap; telemetry queries resolve in well under that).
  let done = false
  for (let i = 0; i < 60 && !done; i++) {
    const ex = await athena().send(new GetQueryExecutionCommand({ QueryExecutionId: qid }))
    const state = ex.QueryExecution?.Status?.State
    if (state === 'SUCCEEDED') {
      done = true
    } else if (state === 'FAILED' || state === 'CANCELLED') {
      throw new Error(`Athena query ${state}: ${ex.QueryExecution?.Status?.StateChangeReason ?? ''}`)
    } else {
      await new Promise(r => setTimeout(r, 300))
    }
  }
  if (!done) throw new Error('Athena query timed out')

  const records: TelemetryRecord[] = []
  let cols: { name: string; type: string }[] = []
  let token: string | undefined
  let firstPage = true
  do {
    const res = await athena().send(
      new GetQueryResultsCommand({ QueryExecutionId: qid, NextToken: token, MaxResults: 1000 })
    )
    if (cols.length === 0) {
      cols = (res.ResultSet?.ResultSetMetadata?.ColumnInfo ?? []).map(c => ({
        name: c.Name ?? '',
        type: c.Type ?? 'varchar',
      }))
    }
    const rows = res.ResultSet?.Rows ?? []
    for (let i = 0; i < rows.length; i++) {
      // Athena repeats the column-name header as the first row of the first page.
      if (firstPage && i === 0) continue
      const data = rows[i].Data ?? []
      const obj: Record<string, unknown> = {}
      cols.forEach((c, j) => {
        obj[c.name] = coerceCell(data[j]?.VarCharValue, c.type)
      })
      records.push(normalizeRecord(obj as unknown as TelemetryRecord))
    }
    firstPage = false
    token = res.NextToken
  } while (token)

  return records
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
  // Match by session id; also include records with no uid so SERVER error records
  // (which carry the sid via the jdlab_sid cookie but not a uid) appear inline in
  // the timeline right after the actions that led to them.
  return all
    .filter(r => r.sid === sid && (r.uid === uid || r.uid == null))
    .sort((a, b) => eventTime(a) - eventTime(b))
}

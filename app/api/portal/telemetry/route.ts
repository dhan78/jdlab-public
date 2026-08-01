/**
 * Telemetry ingestion endpoint. Accepts batches of client interaction events
 * (from lib/telemetry.ts via fetch keepalive or navigator.sendBeacon), enriches
 * them with server-trusted context, and forwards to Kinesis Firehose -> S3.
 *
 * Responds 204 immediately and ships in the background (this runs on a
 * persistent Node process, so the fire-and-forget promise completes after the
 * response). Telemetry must never add latency to, or break, user interactions.
 */
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { cookies } from 'next/headers'
import { verifySessionToken } from '@/lib/portal-auth'
import { shipTelemetry } from '@/lib/telemetry-sink'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Defensive caps so a malformed/hostile client can't flood the pipeline.
const MAX_EVENTS = 200

interface ClientEvent {
  sid?: string
  ev?: string
  t?: number
  url?: string
  props?: Record<string, unknown>
}

export async function POST(request: NextRequest) {
  let payload: { events?: unknown } | null = null
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const raw = Array.isArray(payload?.events) ? (payload!.events as ClientEvent[]) : []
  if (raw.length === 0) return new NextResponse(null, { status: 204 })

  // Best-effort identity from the session cookie (endpoint isn't in the
  // middleware-guarded path, so we verify here). Never blocks on failure.
  const store = await cookies()
  const token = store.get('portal-session')?.value
  const session = token ? await verifySessionToken(token).catch(() => null) : null

  const ingestT = Date.now()
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
  const ua = request.headers.get('user-agent') || null
  // One correlation id per ingested batch, so the events flushed together (and
  // any error that shares the sid) can be grouped on the session timeline.
  const reqId = randomUUID()

  const enriched = raw.slice(0, MAX_EVENTS).map(e => ({
    sid: typeof e.sid === 'string' ? e.sid.slice(0, 64) : null,
    ev: typeof e.ev === 'string' ? e.ev.slice(0, 64) : 'unknown',
    // Flag client errors so they sit alongside server errors (WHERE kind='error'),
    // and lift the case token (set by CaseThread's reportClientError) into the
    // top-level case_token column so the diagnostic error query groups by case.
    ...(e.ev === 'client_error'
      ? {
          kind: 'error',
          level: 'error',
          case_token:
            e.props &&
            typeof e.props === 'object' &&
            typeof (e.props as Record<string, unknown>).caseToken === 'string'
              ? ((e.props as Record<string, unknown>).caseToken as string).slice(0, 32)
              : null,
        }
      : {}),
    req_id: reqId,
    client_t: typeof e.t === 'number' ? e.t : null,
    url: typeof e.url === 'string' ? e.url.slice(0, 512) : null,
    props: e.props && typeof e.props === 'object' ? e.props : undefined,
    uid: session?.sub ?? null,
    role: session?.role ?? null,
    ingest_t: ingestT,
    ip,
    ua,
  }))

  // Fire-and-forget: respond immediately, ship in the background.
  void shipTelemetry(enriched)

  return new NextResponse(null, { status: 204 })
}

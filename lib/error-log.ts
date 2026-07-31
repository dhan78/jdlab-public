import { randomUUID } from 'crypto'
import { shipTelemetry } from './telemetry-sink'

/**
 * Application error logging. Records an error into the SAME pipeline as
 * interaction telemetry — Kinesis Firehose -> S3 (NDJSON) in prod, or the local
 * NDJSON file in dev — flagged with `kind: 'error'` + `level: 'error'` so it's
 * trivially filterable in Athena (`WHERE kind = 'error'`) and never mixed up
 * with normal interaction events.
 *
 * Best-effort and NEVER throws: error logging must not itself cause errors.
 * Do not pass PHI or message/comment text in `detail`.
 */

/** A fresh correlation id for one error occurrence. */
export function newReqId(): string {
  return randomUUID()
}

/** Read the client session id mirrored into the `jdlab_sid` cookie (set by the
 *  telemetry client) so a SERVER error can be tied to the same session timeline
 *  as the user's interaction events. */
export function sidFromCookie(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null
  const m = /(?:^|;\s*)jdlab_sid=([^;]+)/.exec(cookieHeader)
  return m ? decodeURIComponent(m[1]).slice(0, 64) : null
}

export interface ErrorContext {
  route?: string | null
  method?: string | null
  routeType?: string | null
  status?: number | null
  uid?: string | null
  role?: string | null
  ip?: string | null
  caseToken?: string | null
  /** Short, non-PHI note about where/what failed (e.g. 'message notification'). */
  detail?: string | null
  /** Correlation id for this error occurrence (defaults to a fresh uuid). */
  reqId?: string | null
  /** Client session id (from the jdlab_sid cookie) — ties into the timeline. */
  sid?: string | null
}

export function captureError(err: unknown, ctx: ErrorContext = {}): void {
  try {
    const e = err as Partial<Error> | undefined
    const message =
      typeof e?.message === 'string' ? e.message : typeof err === 'string' ? err : String(err)

    const record = {
      kind: 'error' as const,
      level: 'error' as const,
      ev: 'app_error',
      req_id: ctx.reqId ?? newReqId(),
      sid: ctx.sid ?? null,
      message: message.slice(0, 2000),
      name: typeof e?.name === 'string' ? e.name : null,
      stack: typeof e?.stack === 'string' ? e.stack.slice(0, 6000) : null,
      route: ctx.route ?? null,
      method: ctx.method ?? null,
      route_type: ctx.routeType ?? null,
      status: ctx.status ?? null,
      uid: ctx.uid ?? null,
      role: ctx.role ?? null,
      ip: ctx.ip ?? null,
      case_token: ctx.caseToken ?? null,
      detail: ctx.detail ?? null,
      env: process.env.NODE_ENV ?? null,
      ingest_t: Date.now(),
    }

    // Keep a server-side line for container logs / local visibility.
    console.error(`[app_error] ${ctx.method ?? ''} ${ctx.route ?? ''} — ${record.message}`)
    void shipTelemetry([record])
  } catch {
    /* never throw from the error logger */
  }
}

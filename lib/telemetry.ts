'use client'

/**
 * Client interaction telemetry. Records semantic events (session_start,
 * case_open, filter toggles, message_send, ...) so a session can be replayed to
 * reproduce what a user did. Fully async and non-blocking:
 *
 *  - track() just pushes onto an in-memory queue (cheap, synchronous).
 *  - The queue flushes in batches — when it reaches MAX_BATCH, on a short timer,
 *    and on tab-hide/unload via navigator.sendBeacon (survives navigation).
 *  - Delivery uses fetch({ keepalive }) / sendBeacon; failures are swallowed.
 *
 * No PHI: callers must pass only interaction metadata (ids, counts, lengths),
 * never message/comment text or patient data.
 */

type Props = Record<string, unknown>

interface TEvent {
  sid: string
  ev: string
  t: number
  url: string
  props?: Props
}

const ENDPOINT = '/api/portal/telemetry'
const MAX_BATCH = 15
const FLUSH_MS = 4000
const SID_KEY = 'jdlab.telemetry.sid'
const STARTED_KEY = 'jdlab.telemetry.started'

let queue: TEvent[] = []
let timer: ReturnType<typeof setTimeout> | null = null
let started = false

function sessionId(): string {
  if (typeof window === 'undefined') return 'ssr'
  try {
    let s = window.sessionStorage.getItem(SID_KEY)
    if (!s) {
      s = crypto.randomUUID()
      window.sessionStorage.setItem(SID_KEY, s)
    }
    // Mirror the session id into a (non-HttpOnly) cookie so the SERVER can stamp
    // its error records with the same sid — tying server errors into this
    // session's interaction timeline. Not sensitive: it's a random id.
    try {
      document.cookie = `jdlab_sid=${s}; path=/; max-age=86400; samesite=lax`
    } catch {
      /* cookies blocked — server-side sid correlation just won't be available */
    }
    return s
  } catch {
    // sessionStorage blocked — fall back to a per-load id.
    return 'nostore'
  }
}

/** Send whatever is queued. Uses sendBeacon on unload so it isn't dropped. */
export function flushTelemetry(useBeacon = false): void {
  if (typeof window === 'undefined' || queue.length === 0) return
  const batch = queue
  queue = []
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  const body = JSON.stringify({ events: batch })
  try {
    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }))
    } else {
      void fetch(ENDPOINT, {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
      }).catch(() => {})
    }
  } catch {
    /* telemetry must never break the app */
  }
}

function scheduleFlush(): void {
  if (timer) return
  timer = setTimeout(() => {
    timer = null
    flushTelemetry()
  }, FLUSH_MS)
}

/** Record an interaction. Cheap + synchronous; delivery happens in batches. */
export function track(ev: string, props?: Props): void {
  if (typeof window === 'undefined') return
  queue.push({ sid: sessionId(), ev, t: Date.now(), url: window.location.pathname, props })
  if (queue.length >= MAX_BATCH) flushTelemetry()
  else scheduleFlush()
}

/** Start a session: emit session_start once and wire up unload flushing. */
export function startTelemetry(): void {
  if (started || typeof window === 'undefined') return
  started = true

  // Emit session_start ONCE per browser session (sessionStorage lifetime), not
  // once per page LOAD. A full-page navigation (e.g. an `<a href>` route link, or
  // a mobile reload) re-executes this module with the module-level `started`
  // reset to false, which would otherwise emit a fresh session_start on every
  // hard navigation. The sid is stable across those reloads (sessionStorage), so
  // guard the marker with a matching per-session flag.
  let firstInSession = true
  try {
    if (window.sessionStorage.getItem(STARTED_KEY) === '1') firstInSession = false
    else window.sessionStorage.setItem(STARTED_KEY, '1')
  } catch {
    /* sessionStorage blocked — treat each load as a new session */
  }

  if (firstInSession) {
    track('session_start', {
      ua: navigator.userAgent,
      ref: document.referrer || undefined,
      w: window.innerWidth,
      h: window.innerHeight,
      lang: navigator.language,
    })
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushTelemetry(true)
  })
  window.addEventListener('pagehide', () => flushTelemetry(true))
}

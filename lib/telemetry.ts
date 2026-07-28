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
  track('session_start', {
    ua: navigator.userAgent,
    ref: document.referrer || undefined,
    w: window.innerWidth,
    h: window.innerHeight,
    lang: navigator.language,
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushTelemetry(true)
  })
  window.addEventListener('pagehide', () => flushTelemetry(true))
}

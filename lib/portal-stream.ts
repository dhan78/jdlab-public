'use client'

/**
 * A single shared EventSource to /api/portal/stream for the whole portal.
 * Components subscribe via subscribeCaseEvents(); the connection is opened on
 * the first subscriber and reused by everyone (sidebar, dashboard, open thread)
 * so we hold ONE connection instead of one-per-open-case.
 */
export interface StreamEvent {
  caseId: string
  event: 'update' | 'typing'
  data?: unknown
}

type Handler = (e: StreamEvent) => void

let source: EventSource | null = null
const handlers = new Set<Handler>()

function ensureConnection(): void {
  if (source || typeof window === 'undefined') return
  source = new EventSource('/api/portal/stream')

  const forward = (event: 'update' | 'typing') => (ev: MessageEvent) => {
    let parsed: { caseId: string; data?: unknown }
    try {
      parsed = JSON.parse(ev.data)
    } catch {
      return
    }
    const e: StreamEvent = { event, caseId: parsed.caseId, data: parsed.data }
    handlers.forEach(h => {
      try {
        h(e)
      } catch {
        /* one bad handler shouldn't break the rest */
      }
    })
  }

  source.addEventListener('update', forward('update'))
  source.addEventListener('typing', forward('typing'))
  // EventSource auto-reconnects on error; nothing to do here.

  bindReconnectOnFocus()
}

// A backgrounded (esp. mobile) tab is frozen and its EventSource is closed
// without auto-reconnecting. When the tab becomes visible again, re-open the
// connection if it died so live updates resume. Bound once, app-wide.
let reconnectBound = false
function bindReconnectOnFocus(): void {
  if (reconnectBound || typeof window === 'undefined') return
  reconnectBound = true
  const onVisible = () => {
    if (document.visibilityState !== 'visible') return
    if (!source || source.readyState === EventSource.CLOSED) {
      source?.close()
      source = null
      ensureConnection()
    }
  }
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('focus', onVisible)
}

export function subscribeCaseEvents(handler: Handler): () => void {
  handlers.add(handler)
  ensureConnection()
  return () => {
    handlers.delete(handler)
    // Connection is left open (the persistent sidebar keeps a subscriber); it
    // costs one idle connection and avoids reconnect churn during navigation.
  }
}

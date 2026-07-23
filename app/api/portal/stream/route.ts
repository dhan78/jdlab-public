import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies, verifySessionToken } from '@/lib/portal-auth'
import { onCaseEvents } from '@/lib/case-events'

// SSE needs the Node runtime (EventEmitter) and must not be statically cached.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET: single activity stream for the whole portal. Forwards every case event
// (update / typing) tagged with its caseId, so one connection serves the
// dashboard, sidebar, AND the open case thread. Events are scoped: doctors only
// receive events for their own cases. doctorId is never sent to the client.
export async function GET(request: NextRequest) {
  const token = getSessionFromCookies(request.headers.get('cookie'))
  if (!token) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const session = await verifySessionToken(token)
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const encoder = new TextEncoder()
  let unsubscribe: () => void = () => {}
  let heartbeat: ReturnType<typeof setInterval> | undefined

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const safeEnqueue = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk))
        } catch {
          /* stream already closed */
        }
      }

      safeEnqueue('retry: 5000\n\n')

      unsubscribe = onCaseEvents((e) => {
        // Scope: doctors only see events for their own cases.
        if (session.role === 'doctor' && e.doctorId !== session.sub) return
        const payload = JSON.stringify({ caseId: e.caseId, data: e.data })
        safeEnqueue(`event: ${e.event}\ndata: ${payload}\n\n`)
      })

      heartbeat = setInterval(() => safeEnqueue(': ping\n\n'), 25_000)

      const close = () => {
        if (heartbeat) clearInterval(heartbeat)
        unsubscribe()
        try {
          controller.close()
        } catch {
          /* already closed */
        }
      }
      request.signal.addEventListener('abort', close)
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat)
      unsubscribe()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

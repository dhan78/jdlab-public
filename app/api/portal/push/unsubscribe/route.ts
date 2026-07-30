import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies, verifySessionToken } from '@/lib/portal-auth'
import { deletePushSubscription } from '@/lib/push'

export const runtime = 'nodejs'

// POST: drop this browser's Web Push subscription (user turned notifications off).
export async function POST(request: NextRequest) {
  const token = getSessionFromCookies(request.headers.get('cookie'))
  const session = token ? await verifySessionToken(token) : null
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  let endpoint: string | undefined
  try {
    const body = (await request.json()) as { endpoint?: unknown }
    if (typeof body.endpoint === 'string') endpoint = body.endpoint
  } catch {
    /* ignore */
  }

  if (endpoint) await deletePushSubscription(endpoint)
  return NextResponse.json({ ok: true })
}

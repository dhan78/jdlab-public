import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies, verifySessionToken } from '@/lib/portal-auth'
import { savePushSubscription, isPushEnabled } from '@/lib/push'

export const runtime = 'nodejs'

// POST: register this browser's Web Push subscription for the current user.
export async function POST(request: NextRequest) {
  const token = getSessionFromCookies(request.headers.get('cookie'))
  const session = token ? await verifySessionToken(token) : null
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  if (!isPushEnabled()) {
    return NextResponse.json({ error: 'Push is not configured' }, { status: 501 })
  }

  let sub: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  try {
    sub = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
  }

  if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
  }

  await savePushSubscription(Number(session.sub), {
    endpoint: sub.endpoint,
    keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
  })
  return NextResponse.json({ ok: true })
}

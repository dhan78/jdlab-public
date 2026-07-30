import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies, verifySessionToken } from '@/lib/portal-auth'
import { clearNotifications } from '@/lib/notifications'

export const runtime = 'nodejs'

// POST: delete all of the current user's notifications ("Clear all").
export async function POST(request: NextRequest) {
  const token = getSessionFromCookies(request.headers.get('cookie'))
  const session = token ? await verifySessionToken(token) : null
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  await clearNotifications(Number(session.sub))
  return NextResponse.json({ ok: true })
}

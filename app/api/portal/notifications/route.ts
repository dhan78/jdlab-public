import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies, verifySessionToken } from '@/lib/portal-auth'
import { listNotifications } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET: the current user's recent notifications + unread count (powers the bell).
export async function GET(request: NextRequest) {
  const token = getSessionFromCookies(request.headers.get('cookie'))
  const session = token ? await verifySessionToken(token) : null
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const data = await listNotifications(Number(session.sub))
  return NextResponse.json(data)
}

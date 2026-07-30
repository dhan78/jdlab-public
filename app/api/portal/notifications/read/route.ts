import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies, verifySessionToken } from '@/lib/portal-auth'
import { markNotificationsRead } from '@/lib/notifications'

export const runtime = 'nodejs'

// POST: mark one notification read ({ id }) or all of the user's ({} / no id).
export async function POST(request: NextRequest) {
  const token = getSessionFromCookies(request.headers.get('cookie'))
  const session = token ? await verifySessionToken(token) : null
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  let id: number | undefined
  try {
    const body = (await request.json()) as { id?: unknown }
    if (typeof body.id === 'number' && Number.isInteger(body.id)) id = body.id
  } catch {
    /* empty body = mark all */
  }

  await markNotificationsRead(Number(session.sub), id)
  return NextResponse.json({ ok: true })
}

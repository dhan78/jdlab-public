/**
 * Admin-only read API for the Session Timeline viewer.
 *
 *   GET /api/portal/admin/telemetry            -> { users, source }
 *   GET /api/portal/admin/telemetry?uid=X      -> { sessions }
 *   GET /api/portal/admin/telemetry?uid=X&sid=Y-> { events }
 *
 * Gated to the admin role here (middleware also protects /portal/admin/* pages,
 * but this API lives under /api and does its own check).
 */
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySessionToken } from '@/lib/portal-auth'
import { listDoctors } from '@/lib/portal-store'
import {
  listActiveUsers,
  listSessions,
  getSessionEvents,
  isDevTelemetrySource,
} from '@/lib/telemetry-query'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const store = await cookies()
  const token = store.get('portal-session')?.value
  const session = token ? await verifySessionToken(token).catch(() => null) : null
  return session && session.role === 'admin' ? session : null
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const uid = request.nextUrl.searchParams.get('uid')
  const sid = request.nextUrl.searchParams.get('sid')

  if (uid && sid) {
    return NextResponse.json({ events: await getSessionEvents(uid, sid) })
  }
  if (uid) {
    return NextResponse.json({ sessions: await listSessions(uid) })
  }

  // User picker: active users joined with names (doctors) where available.
  const [active, doctors] = await Promise.all([listActiveUsers(), listDoctors()])
  const nameById = new Map(doctors.map(d => [d.id, d.name]))
  const users = active.map(u => ({
    uid: u.uid,
    name: nameById.get(u.uid) ?? null,
    role: u.role,
    lastT: u.lastT,
    sessions: u.sessions,
    events: u.events,
  }))
  return NextResponse.json({ users, source: isDevTelemetrySource() ? 'dev-file' : 'firehose' })
}

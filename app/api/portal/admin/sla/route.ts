import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies, verifySessionToken } from '@/lib/portal-auth'
import type { SessionPayload } from '@/lib/portal-auth'
import { getSlaSettings, setSlaSetting } from '@/lib/sla-config'
import { CASE_TYPES, type CaseType } from '@/lib/case-meta'
import { recordAudit } from '@/lib/audit'
import { clientIp } from '@/lib/rate-limit'

async function getSession(request: NextRequest): Promise<SessionPayload | null> {
  const token = getSessionFromCookies(request.headers.get('cookie'))
  if (!token) return null
  return verifySessionToken(token)
}

// GET: current resolved SLA turnaround per case type (admin only).
export async function GET(request: NextRequest) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Admins only' }, { status: 403 })
  }
  return NextResponse.json({ settings: await getSlaSettings() })
}

// PUT: update one case type's turnaround (business days).
export async function PUT(request: NextRequest) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Admins only' }, { status: 403 })
  }

  let body: { caseType?: unknown; standardDays?: unknown; rushDays?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const caseType = body.caseType
  if (typeof caseType !== 'string' || !CASE_TYPES.includes(caseType as CaseType)) {
    return NextResponse.json({ error: 'Unknown case type' }, { status: 400 })
  }
  const standardDays = Number(body.standardDays)
  const rushDays = Number(body.rushDays)
  if (!Number.isFinite(standardDays) || !Number.isFinite(rushDays)) {
    return NextResponse.json({ error: 'Days must be numbers' }, { status: 400 })
  }

  await setSlaSetting(caseType as CaseType, standardDays, rushDays)
  await recordAudit({
    actorId: session.sub,
    actorRole: session.role,
    action: 'sla.update',
    detail: `${caseType}: ${standardDays}/${rushDays}`,
    ip: clientIp(request),
  })

  return NextResponse.json({ settings: await getSlaSettings() })
}

import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies, verifySessionToken } from '@/lib/portal-auth'
import type { SessionPayload } from '@/lib/portal-auth'
import {
  listPracticeMappings,
  setPracticeMapping,
  deletePracticeMapping,
} from '@/lib/practice-map'
import { findDoctorByEmail } from '@/lib/portal-store'
import { recordAudit } from '@/lib/audit'
import { clientIp } from '@/lib/rate-limit'

async function getSession(request: NextRequest): Promise<SessionPayload | null> {
  const token = getSessionFromCookies(request.headers.get('cookie'))
  if (!token) return null
  return verifySessionToken(token)
}

async function requireAdmin(request: NextRequest): Promise<SessionPayload | NextResponse> {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  if (session.role !== 'admin') return NextResponse.json({ error: 'Admins only' }, { status: 403 })
  return session
}

// GET: all practice → doctor mappings used by automated ingestion (admin only).
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (admin instanceof NextResponse) return admin
  return NextResponse.json({ mappings: await listPracticeMappings() })
}

// PUT: upsert one mapping { practiceKey, doctorEmail }. Validates the doctor
// exists so a mapping can never point at a missing account.
export async function PUT(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (admin instanceof NextResponse) return admin

  let body: { practiceKey?: unknown; doctorEmail?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
  const practiceKey = typeof body.practiceKey === 'string' ? body.practiceKey.trim() : ''
  const doctorEmail = typeof body.doctorEmail === 'string' ? body.doctorEmail.trim().toLowerCase() : ''
  if (!practiceKey || !doctorEmail) {
    return NextResponse.json({ error: 'practiceKey and doctorEmail are required' }, { status: 400 })
  }
  if (!(await findDoctorByEmail(doctorEmail))) {
    return NextResponse.json({ error: `No portal account for ${doctorEmail}` }, { status: 400 })
  }
  await setPracticeMapping(practiceKey, doctorEmail)
  await recordAudit({
    actorId: admin.sub,
    actorRole: admin.role,
    action: 'practice_map.set',
    detail: `${practiceKey} -> ${doctorEmail}`,
    ip: clientIp(request),
  })
  return NextResponse.json({ mappings: await listPracticeMappings() })
}

// DELETE: remove one mapping by ?practiceKey=.
export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (admin instanceof NextResponse) return admin
  const practiceKey = new URL(request.url).searchParams.get('practiceKey')?.trim() ?? ''
  if (!practiceKey) return NextResponse.json({ error: 'practiceKey is required' }, { status: 400 })
  await deletePracticeMapping(practiceKey)
  await recordAudit({
    actorId: admin.sub,
    actorRole: admin.role,
    action: 'practice_map.delete',
    detail: practiceKey,
    ip: clientIp(request),
  })
  return NextResponse.json({ mappings: await listPracticeMappings() })
}

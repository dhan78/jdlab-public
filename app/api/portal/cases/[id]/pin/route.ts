import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies, verifySessionToken } from '@/lib/portal-auth'
import type { SessionPayload } from '@/lib/portal-auth'
import { findCaseById, setPinned } from '@/lib/case-store'

export const runtime = 'nodejs'

async function getSession(request: NextRequest): Promise<SessionPayload | null> {
  const token = getSessionFromCookies(request.headers.get('cookie'))
  if (!token) return null
  return verifySessionToken(token)
}

// Doctors may only touch their own cases; planners/admins may pin any case.
function canAccess(session: SessionPayload, caseDoctorId: string): boolean {
  if (session.role === 'doctor') return session.sub === caseDoctorId
  return true
}

async function resolve(
  request: NextRequest,
  params: Promise<{ id: string }>
): Promise<{ session: SessionPayload; id: string } | NextResponse> {
  const { id } = await params
  const session = await getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const caseRow = await findCaseById(id)
  if (!caseRow) {
    return NextResponse.json({ error: 'Case not found' }, { status: 404 })
  }
  if (!canAccess(session, caseRow.doctorId)) {
    return NextResponse.json({ error: 'You do not have access to this case' }, { status: 403 })
  }
  return { session, id }
}

// POST: pin this case for the current user (keep it in the recently-viewed rail
// until unpinned). Idempotent.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const r = await resolve(request, params)
  if (r instanceof NextResponse) return r
  await setPinned(r.session.sub, r.id, true)
  return NextResponse.json({ pinned: true })
}

// DELETE: unpin this case for the current user. Idempotent.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const r = await resolve(request, params)
  if (r instanceof NextResponse) return r
  await setPinned(r.session.sub, r.id, false)
  return NextResponse.json({ pinned: false })
}

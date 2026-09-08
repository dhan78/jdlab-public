import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies, verifySessionToken } from '@/lib/portal-auth'
import type { SessionPayload } from '@/lib/portal-auth'
import { findCaseById, deleteCaseAnnotation, deleteAnnotationActivityFor } from '@/lib/case-store'

export const runtime = 'nodejs'

async function getSession(request: NextRequest): Promise<SessionPayload | null> {
  const token = getSessionFromCookies(request.headers.get('cookie'))
  if (!token) return null
  return verifySessionToken(token)
}

function canAccess(session: SessionPayload, caseDoctorId: string): boolean {
  if (session.role === 'doctor') return session.sub === caseDoctorId
  return true
}

// DELETE: remove a pin. The author may delete their own; admins may delete any.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; annId: string }> }
) {
  const { id, annId } = await params
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

  const removed = await deleteCaseAnnotation(id, annId, session.sub, session.role)
  if (!removed) {
    return NextResponse.json({ error: 'Annotation not found or not yours to delete' }, { status: 404 })
  }
  // Drop the matching thread activity entry so a deleted/repositioned pin
  // doesn't leave a stale entry with a dead deep-link.
  const removedMessageIds = await deleteAnnotationActivityFor(id, annId)
  return NextResponse.json({ deleted: true, removedMessageIds })
}

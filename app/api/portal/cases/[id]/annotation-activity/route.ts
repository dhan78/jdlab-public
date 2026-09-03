import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies, verifySessionToken } from '@/lib/portal-auth'
import type { SessionPayload } from '@/lib/portal-auth'
import { findCaseById, addMessage } from '@/lib/case-store'
import { buildAnnotationActivity } from '@/lib/annotation-activity'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

async function getSession(request: NextRequest): Promise<SessionPayload | null> {
  const token = getSessionFromCookies(request.headers.get('cookie'))
  if (!token) return null
  return verifySessionToken(token)
}

// Doctors may only touch their own cases; planners/admins may act on any case.
function canAccess(session: SessionPayload, caseDoctorId: string): boolean {
  if (session.role === 'doctor') return session.sub === caseDoctorId
  return true
}

// POST: record a single "annotation activity" summary in the thread for a batch
// of pins/measurements the author just added to one model. The client buffers a
// review session and posts ONE of these (not one per pin) so the thread shows a
// discoverable, deep-linkable entry without flooding the conversation.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const caseRow = await findCaseById(id)
  if (!caseRow) return NextResponse.json({ error: 'Case not found' }, { status: 404 })
  if (!canAccess(session, caseRow.doctorId)) {
    return NextResponse.json({ error: 'You do not have access to this case' }, { status: 403 })
  }

  const rl = rateLimit(`annotate-activity:${session.sub}`, 60, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many updates. Please wait a moment.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    )
  }

  let body: {
    attachmentId?: unknown
    previewKey?: unknown
    modelName?: unknown
    annotationIds?: unknown
    notes?: unknown
    kind?: unknown
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const attachmentId = typeof body.attachmentId === 'string' ? body.attachmentId : null
  const previewKey = typeof body.previewKey === 'string' ? body.previewKey : null
  if (!attachmentId && !previewKey) {
    return NextResponse.json({ error: 'A model target and at least one annotation are required' }, { status: 400 })
  }

  const { summary, meta } = buildAnnotationActivity({
    attachmentId,
    previewKey,
    modelName: typeof body.modelName === 'string' ? body.modelName : undefined,
    annotationIds: Array.isArray(body.annotationIds) ? body.annotationIds.filter((x): x is string => typeof x === 'string') : [],
    notes: Array.isArray(body.notes) ? body.notes.filter((x): x is string => typeof x === 'string') : [],
    kind: typeof body.kind === 'string' ? body.kind : undefined,
  })

  if ((meta.count ?? 0) === 0) {
    return NextResponse.json({ error: 'A model target and at least one annotation are required' }, { status: 400 })
  }

  const message = await addMessage({
    caseId: id,
    authorId: session.sub,
    authorName: session.name,
    authorRole: session.role,
    body: summary,
    kind: 'annotation',
    meta,
    attachments: [],
  })

  return NextResponse.json({ message }, { status: 201 })
}

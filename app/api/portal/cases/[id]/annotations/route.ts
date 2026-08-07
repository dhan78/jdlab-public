import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies, verifySessionToken } from '@/lib/portal-auth'
import type { SessionPayload } from '@/lib/portal-auth'
import {
  findCaseById,
  listCaseAnnotations,
  createCaseAnnotation,
} from '@/lib/case-store'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

async function getSession(request: NextRequest): Promise<SessionPayload | null> {
  const token = getSessionFromCookies(request.headers.get('cookie'))
  if (!token) return null
  return verifySessionToken(token)
}

// Doctors may only touch their own cases; planners/admins may annotate any case.
function canAccess(session: SessionPayload, caseDoctorId: string): boolean {
  if (session.role === 'doctor') return session.sub === caseDoctorId
  return true
}

async function resolve(
  request: NextRequest,
  params: Promise<{ id: string }>
): Promise<{ session: SessionPayload; id: string; doctorId: string } | NextResponse> {
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
  return { session, id, doctorId: caseRow.doctorId }
}

// A pin is deletable by its author, or by any admin.
function canDelete(session: SessionPayload, authorId: string | null): boolean {
  return session.role === 'admin' || (authorId != null && authorId === session.sub)
}

// GET: list every 3D annotation on the case (grouped client-side by attachment).
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const r = await resolve(request, params)
  if (r instanceof NextResponse) return r
  const annotations = await listCaseAnnotations(r.id)
  return NextResponse.json({
    annotations: annotations.map(a => ({ ...a, canDelete: canDelete(r.session, a.authorId) })),
  })
}

// POST: create a pin at a surface point on a specific model attachment.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const r = await resolve(request, params)
  if (r instanceof NextResponse) return r

  const rl = rateLimit(`annotate:${r.session.sub}`, 120, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many annotations. Please wait a moment.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    )
  }

  let body: { attachmentId?: unknown; kind?: unknown; x?: unknown; y?: unknown; z?: unknown; bx?: unknown; by?: unknown; bz?: unknown; body?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const attachmentId = typeof body.attachmentId === 'string' ? body.attachmentId : ''
  const kind = body.kind === 'measure' ? 'measure' : 'pin'
  const x = typeof body.x === 'number' ? body.x : NaN
  const y = typeof body.y === 'number' ? body.y : NaN
  const z = typeof body.z === 'number' ? body.z : NaN
  const bx = typeof body.bx === 'number' ? body.bx : null
  const by = typeof body.by === 'number' ? body.by : null
  const bz = typeof body.bz === 'number' ? body.bz : null
  const note = typeof body.body === 'string' ? body.body.trim() : ''

  if (!attachmentId || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    return NextResponse.json({ error: 'A point on the model is required' }, { status: 400 })
  }
  // A measurement needs its second point; the note is optional for it.
  if (kind === 'measure') {
    if (!Number.isFinite(bx) || !Number.isFinite(by) || !Number.isFinite(bz)) {
      return NextResponse.json({ error: 'A measurement needs two points' }, { status: 400 })
    }
  } else if (!note) {
    return NextResponse.json({ error: 'A note is required' }, { status: 400 })
  }

  const created = await createCaseAnnotation(r.id, {
    attachmentId,
    kind,
    x,
    y,
    z,
    bx,
    by,
    bz,
    body: note,
    authorId: r.session.sub,
    authorName: r.session.name,
    authorRole: r.session.role,
  })
  if (!created) {
    return NextResponse.json({ error: 'That attachment is not part of this case' }, { status: 404 })
  }
  return NextResponse.json({ annotation: { ...created, canDelete: true } }, { status: 201 })
}

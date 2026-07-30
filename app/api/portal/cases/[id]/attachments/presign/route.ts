import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies, verifySessionToken } from '@/lib/portal-auth'
import type { SessionPayload } from '@/lib/portal-auth'
import { findCaseById } from '@/lib/case-store'
import { isS3Enabled, attachmentKey, createUploadUrl } from '@/lib/storage'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

// Direct-upload cap. Large enough for full-arch exocad WebViewer HTML and
// full-mouth STL/PLY scans; the messages route re-checks the real S3 size.
const MAX_UPLOAD_BYTES = 150 * 1024 * 1024

async function getSession(request: NextRequest): Promise<SessionPayload | null> {
  const token = getSessionFromCookies(request.headers.get('cookie'))
  if (!token) return null
  return verifySessionToken(token)
}

function canAccess(session: SessionPayload, caseDoctorId: string): boolean {
  if (session.role === 'doctor') return session.sub === caseDoctorId
  return true
}

// exocad WebViewer exports must be served as text/html to render inline in the
// sandboxed iframe; everything else keeps its own type (or a safe default).
function contentTypeFor(name: string, mimeType: string): string {
  if (/\.html?$/i.test(name)) return 'text/html'
  return /^[\w.+-]+\/[\w.+-]+$/.test(mimeType) ? mimeType : 'application/octet-stream'
}

// POST: issue a presigned S3 PUT so the browser uploads an attachment DIRECTLY
// to S3, bypassing the JSON body (and its 8 MB base64 cap). Returns
// { key, uploadUrl, contentType }; the client PUTs the file to uploadUrl with
// `Content-Type: contentType`, then posts the message referencing `key`.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  if (!isS3Enabled()) {
    // Dev / no bucket: the client falls back to the inline base64 path.
    return NextResponse.json({ error: 'Direct upload is not configured' }, { status: 501 })
  }

  const rl = rateLimit(`presign:${session.sub}`, 60, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many upload requests. Please wait a moment.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    )
  }

  const caseRow = await findCaseById(id)
  if (!caseRow) {
    return NextResponse.json({ error: 'Case not found' }, { status: 404 })
  }
  if (!canAccess(session, caseRow.doctorId)) {
    return NextResponse.json({ error: 'You do not have access to this case' }, { status: 403 })
  }

  let body: { name?: unknown; mimeType?: unknown; size?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const mimeType = typeof body.mimeType === 'string' ? body.mimeType : ''
  const size = typeof body.size === 'number' ? body.size : 0

  if (!name) {
    return NextResponse.json({ error: 'A file name is required' }, { status: 400 })
  }
  if (size <= 0 || size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `File must be between 1 byte and ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB` },
      { status: 413 }
    )
  }

  // Key is case-scoped so the messages route can verify it belongs to this case.
  const key = attachmentKey(name, { caseId: id })
  const uploadUrl = await createUploadUrl(key)

  return NextResponse.json({ key, uploadUrl, contentType: contentTypeFor(name, mimeType) })
}

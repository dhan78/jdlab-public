import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies, verifySessionToken } from '@/lib/portal-auth'
import type { SessionPayload } from '@/lib/portal-auth'
import {
  findCaseById,
  addMessage,
  listMessagesForCase,
  type CaseAttachment,
} from '@/lib/case-store'
import { findDoctorById } from '@/lib/portal-store'
import { recordAudit } from '@/lib/audit'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { sendCaseMessageNotification } from '@/lib/email'
import { emitCaseUpdate } from '@/lib/case-events'

// Per-attachment cap (~8MB of raw bytes). Base64 inflates ~33%, so the JSON
// body is larger; this is a demo in-memory store, so we keep it modest.
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024
const MAX_ATTACHMENTS = 6
const MAX_BODY_LENGTH = 5000

async function getSession(request: NextRequest): Promise<SessionPayload | null> {
  const token = getSessionFromCookies(request.headers.get('cookie'))
  if (!token) return null
  return verifySessionToken(token)
}

function canAccess(session: SessionPayload, caseDoctorId: string): boolean {
  if (session.role === 'doctor') return session.sub === caseDoctorId
  return true
}

interface IncomingAttachment {
  name?: unknown
  mimeType?: unknown
  size?: unknown
  dataUrl?: unknown
}

// GET: list messages for a case (used by the SSE client to refetch on update).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  return NextResponse.json({ messages: await listMessagesForCase(id) })
}

// POST: add a message (with optional image/file attachments) to a case thread.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  // Throttle posting to curb spam / runaway clients.
  const rl = rateLimit(`msg:${session.sub}`, 30, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'You are posting too quickly. Please wait a moment.' },
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

  let body: { body?: unknown; attachments?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'A message body or attachment is required' }, { status: 400 })
  }

  const text = typeof body.body === 'string' ? body.body.trim() : ''
  if (text.length > MAX_BODY_LENGTH) {
    return NextResponse.json({ error: 'Message is too long' }, { status: 400 })
  }

  const rawAttachments = Array.isArray(body.attachments) ? body.attachments : []
  if (rawAttachments.length > MAX_ATTACHMENTS) {
    return NextResponse.json(
      { error: `A message can have at most ${MAX_ATTACHMENTS} attachments` },
      { status: 400 }
    )
  }

  const attachments: CaseAttachment[] = []
  for (const raw of rawAttachments as IncomingAttachment[]) {
    const name = typeof raw.name === 'string' ? raw.name.trim() : ''
    const mimeType = typeof raw.mimeType === 'string' ? raw.mimeType : ''
    const size = typeof raw.size === 'number' ? raw.size : 0
    const dataUrl = typeof raw.dataUrl === 'string' ? raw.dataUrl : ''

    if (!name || !dataUrl.startsWith('data:')) {
      return NextResponse.json({ error: 'Invalid attachment' }, { status: 400 })
    }
    if (size > MAX_ATTACHMENT_BYTES) {
      return NextResponse.json(
        { error: `"${name}" exceeds the ${MAX_ATTACHMENT_BYTES / (1024 * 1024)}MB limit` },
        { status: 400 }
      )
    }

    attachments.push({
      id: crypto.randomUUID(),
      name,
      mimeType,
      size,
      dataUrl,
    })
  }

  if (!text && attachments.length === 0) {
    return NextResponse.json(
      { error: 'A message body or attachment is required' },
      { status: 400 }
    )
  }

  await addMessage({
    caseId: id,
    authorId: session.sub,
    authorName: session.name,
    authorRole: session.role,
    body: text,
    attachments,
  })

  // Notify any open SSE streams for this case so other viewers refetch live.
  emitCaseUpdate(id, caseRow.doctorId)

  await recordAudit({
    actorId: session.sub,
    actorRole: session.role,
    action: 'message.create',
    caseToken: id,
    detail: attachments.length ? `${attachments.length} attachment(s)` : undefined,
    ip: clientIp(request),
  })

  // Notify the other party (doctor <-> lab). Fire-and-forget.
  const snippet = text ? text.slice(0, 200) : `[${attachments.length} attachment(s)]`
  void (async () => {
    try {
      const isFromLab = session.role !== 'doctor'
      const to = isFromLab ? undefined : process.env.LAB_NOTIFY_EMAIL ?? 'info@jdlab.us'
      if (isFromLab) {
        const doctor = await findDoctorById(caseRow.doctorId)
        if (doctor?.email) {
          await sendCaseMessageNotification({
            to: doctor.email,
            recipientName: doctor.name,
            caseNumber: caseRow.caseNumber,
            caseTitle: caseRow.title,
            caseToken: id,
            authorName: session.name,
            snippet,
          })
        }
      } else if (to) {
        await sendCaseMessageNotification({
          to,
          recipientName: 'JD Lab Team',
          caseNumber: caseRow.caseNumber,
          caseTitle: caseRow.title,
          caseToken: id,
          authorName: session.name,
          snippet,
        })
      }
    } catch (err) {
      console.error('[email] message notification failed', err)
    }
  })()

  return NextResponse.json(
    { success: true, messages: await listMessagesForCase(id) },
    { status: 201 }
  )
}

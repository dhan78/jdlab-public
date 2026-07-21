import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies, verifySessionToken } from '@/lib/portal-auth'
import type { SessionPayload } from '@/lib/portal-auth'
import {
  findCaseById,
  listMessagesForCase,
  updateCaseStatus,
  setScanReceived,
  CASE_STATUSES,
  CASE_STATUS_LABELS,
  type CaseStatus,
} from '@/lib/case-store'
import { findDoctorById } from '@/lib/portal-store'
import { recordAudit } from '@/lib/audit'
import { clientIp } from '@/lib/rate-limit'
import { emitCaseUpdate } from '@/lib/case-events'
import { sendCaseStatusNotification } from '@/lib/email'
import { getSlaConfigMap } from '@/lib/sla-config'

async function getSession(request: NextRequest): Promise<SessionPayload | null> {
  const token = getSessionFromCookies(request.headers.get('cookie'))
  if (!token) return null
  return verifySessionToken(token)
}

// A doctor may only see/act on their own cases; planners and admins see all.
function canAccess(session: SessionPayload, caseDoctorId: string): boolean {
  if (session.role === 'doctor') return session.sub === caseDoctorId
  return true
}

// GET: case detail + full message thread.
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

  await recordAudit({
    actorId: session.sub,
    actorRole: session.role,
    action: 'case.view',
    caseToken: id,
    ip: clientIp(request),
  })

  return NextResponse.json({
    case: caseRow,
    messages: await listMessagesForCase(id),
    slaConfig: await getSlaConfigMap(),
  })
}

// PATCH: update case status. Only planners/admins move a case through stages.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  if (session.role !== 'planner' && session.role !== 'admin') {
    return NextResponse.json(
      { error: 'Only the lab team can update case status' },
      { status: 403 }
    )
  }

  const caseRow = await findCaseById(id)
  if (!caseRow) {
    return NextResponse.json({ error: 'Case not found' }, { status: 404 })
  }

  let body: { status?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'A valid status is required' }, { status: 400 })
  }

  // Start/stop the SLA clock: planner marks that the scan files arrived.
  const scanReceived = (body as { scanReceived?: unknown }).scanReceived
  if (typeof scanReceived === 'boolean') {
    await setScanReceived(id, scanReceived)
    emitCaseUpdate(id, caseRow.doctorId)
    await recordAudit({
      actorId: session.sub,
      actorRole: session.role,
      action: 'case.scan_received',
      caseToken: id,
      detail: scanReceived ? 'scans received' : 'scan receipt cleared',
      ip: clientIp(request),
    })
    return NextResponse.json({ ok: true })
  }

  const status = body.status
  if (typeof status !== 'string' || !CASE_STATUSES.includes(status as CaseStatus)) {
    return NextResponse.json(
      { error: `Status must be one of: ${CASE_STATUSES.join(', ')}` },
      { status: 400 }
    )
  }

  const updated = await updateCaseStatus(id, status as CaseStatus, session.sub)

  // Notify open case streams + the global list/sidebar stream.
  emitCaseUpdate(id, caseRow.doctorId)

  await recordAudit({
    actorId: session.sub,
    actorRole: session.role,
    action: 'case.status_change',
    caseToken: id,
    detail: `${caseRow.status} -> ${status}`,
    ip: clientIp(request),
  })

  // Notify the ordering doctor (fire-and-forget; never blocks the response).
  void (async () => {
    try {
      const doctor = await findDoctorById(caseRow.doctorId)
      if (doctor?.email) {
        await sendCaseStatusNotification({
          to: doctor.email,
          recipientName: doctor.name,
          caseNumber: caseRow.caseNumber,
          caseTitle: caseRow.title,
          caseToken: id,
          statusLabel: CASE_STATUS_LABELS[status as CaseStatus],
        })
      }
    } catch (err) {
      console.error('[email] status notification failed', err)
    }
  })()

  return NextResponse.json({ success: true, case: updated })
}

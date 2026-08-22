import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies, verifySessionToken } from '@/lib/portal-auth'
import type { SessionPayload } from '@/lib/portal-auth'
import {
  findCaseById,
  listMessagesForCase,
  updateCaseStatus,
  updateCaseDetails,
  setScanReceived,
  getUnreadCounts,
  isCasePinned,
  purgeCase,
  CASE_STATUSES,
  CASE_STATUS_LABELS,
  CASE_TYPES,
  type CaseStatus,
  type CaseType,
} from '@/lib/case-store'
import { findDoctorById } from '@/lib/portal-store'
import { resolveGlbPreviews } from '@/lib/storage'
import { recordAudit } from '@/lib/audit'
import { clientIp } from '@/lib/rate-limit'
import { emitCaseUpdate } from '@/lib/case-events'
import { sendCaseStatusNotification } from '@/lib/email'
import { getSlaConfigMap } from '@/lib/sla-config'
import { decodeCaseId } from '@/lib/case-code'
import { dispatchNotification } from '@/lib/notify-dispatch'
import { captureError, newReqId, sidFromCookie } from '@/lib/error-log'

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

  const unread = await getUnreadCounts(session.sub, session.role)
  const pinned = await isCasePinned(session.sub, id)
  return NextResponse.json({
    case: { ...caseRow, pinned },
    messages: await listMessagesForCase(id),
    slaConfig: await getSlaConfigMap(),
    unreadCount: unread[id] ?? 0,
    glbPreviews: await resolveGlbPreviews(caseRow.scanCaseId),
  })
}

// PATCH: fill in case details (case owner or lab team) or move a case through
// stages / mark scans received (lab team only).
export async function PATCH(
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

  let body: { status?: unknown; scanReceived?: unknown; details?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // --- Fill in / edit case details: the case owner (doctor) or the lab team ---
  if (body.details && typeof body.details === 'object') {
    if (!canAccess(session, caseRow.doctorId)) {
      return NextResponse.json({ error: 'You do not have access to this case' }, { status: 403 })
    }
    const d = body.details as Record<string, unknown>
    // undefined = leave unchanged; '' = clear; else trimmed value.
    const opt = (v: unknown, max: number): string | null | undefined =>
      v === undefined ? undefined : typeof v === 'string' ? (v.trim() ? v.trim().slice(0, max) : null) : undefined
    const title = typeof d.title === 'string' && d.title.trim() ? d.title.trim().slice(0, 200) : undefined
    const caseType = CASE_TYPES.includes(d.caseType as CaseType) ? (d.caseType as CaseType) : undefined
    const isRush = typeof d.isRush === 'boolean' ? d.isRush : undefined

    const updated = await updateCaseDetails(id, {
      title,
      patientName: opt(d.patientName, 200),
      surgeryDate: opt(d.surgeryDate, 20),
      toothRef: opt(d.toothRef, 100),
      material: opt(d.material, 100),
      scannerBrand: opt(d.scannerBrand, 100),
      specialInstructions: opt(d.specialInstructions, 2000),
      shipToAddress: opt(d.shipToAddress, 400),
      caseType,
      isRush,
    })
    emitCaseUpdate(id, caseRow.doctorId)
    await recordAudit({
      actorId: session.sub,
      actorRole: session.role,
      action: 'case.details_update',
      caseToken: id,
      ip: clientIp(request),
    })
    return NextResponse.json({ ok: true, case: updated })
  }

  // --- Status / scan-receipt changes: lab team only ---
  if (session.role !== 'planner' && session.role !== 'admin') {
    return NextResponse.json(
      { error: 'Only the lab team can update case status' },
      { status: 403 }
    )
  }

  // Start/stop the SLA clock: planner marks that the scan files arrived.
  const scanReceived = body.scanReceived
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
      await dispatchNotification({
        recipientIds: [Number(caseRow.doctorId)],
        caseId: decodeCaseId(id),
        caseToken: id,
        type: 'status',
        title: caseRow.title,
        body: `Status: ${CASE_STATUS_LABELS[status as CaseStatus]}`,
      })
    } catch (err) {
      console.error('[notify] status notification failed', err)
      captureError(err, { route: 'PATCH /api/portal/cases/[id]', method: 'PATCH', detail: 'status notification', caseToken: id, reqId: newReqId(), sid: sidFromCookie(request.headers.get('cookie')) })
    }
  })()

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
      captureError(err, { route: 'PATCH /api/portal/cases/[id]', method: 'PATCH', detail: 'status email', caseToken: id, reqId: newReqId(), sid: sidFromCookie(request.headers.get('cookie')) })
    }
  })()

  return NextResponse.json({ success: true, case: updated })
}

// DELETE: admin-only hard delete. Purges the case, its thread + status history
// (DB cascade), all S3 attachments, and the source raw scan + GLB previews, so
// no storage is left anywhere in AWS.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Only an admin can delete a case' }, { status: 403 })
  }

  const caseRow = await findCaseById(id)
  if (!caseRow) {
    return NextResponse.json({ error: 'Case not found' }, { status: 404 })
  }

  const result = await purgeCase(id)

  await recordAudit({
    actorId: session.sub,
    actorRole: session.role,
    action: 'case.delete',
    // No caseToken: the row is gone, so link nothing (avoids a dangling FK);
    // the identity lives in `detail` for the compliance trail.
    detail: `purged ${caseRow.caseNumber} (${id}): attachments=${result?.attachmentsDeleted ?? 0}, scanObjects=${result?.scanObjectsDeleted ?? 0}`,
    ip: clientIp(request),
  })

  return NextResponse.json({ success: true, ...(result ?? {}) })
}

import { NextRequest, NextResponse } from 'next/server'
import { findDoctorByEmail } from '@/lib/portal-store'
import {
  addCase,
  addMessage,
  findCaseIdByExternalId,
  CASE_TYPES,
  type CaseType,
} from '@/lib/case-store'
import { recordAudit } from '@/lib/audit'
import { clientIp } from '@/lib/rate-limit'
import { resolvePracticeEmail } from '@/lib/practice-map'
import { ingestAuthFailure } from '@/lib/ingest-auth'

// Automated case intake for the ingestion worker (see /ingestion). This is the
// ONLY portal write path that isn't a doctor session: it's guarded by a static
// service token (INGEST_API_TOKEN, from SSM) rather than a cookie, so the
// off-box worker can create a case + attach its scan without logging in.
//
// Idempotent: every request carries an `externalId` (the source system's case
// id). If a case already exists with that id we return it (created:false) so a
// re-delivered scan never double-creates. Choose an ANONYMIZED/non-PHI title.

interface Attachment {
  name: string
  mimeType: string
  size: number
  dataUrl?: string
  storageKey?: string
}

export async function POST(request: NextRequest) {
  const denied = ingestAuthFailure(request)
  if (denied) return denied

  let body: {
    externalId?: unknown
    doctorEmail?: unknown
    practiceKey?: unknown
    title?: unknown
    patientName?: unknown
    toothRef?: unknown
    material?: unknown
    scannerBrand?: unknown
    caseType?: unknown
    isRush?: unknown
    specialInstructions?: unknown
    attachment?: Attachment
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const externalId = typeof body.externalId === 'string' ? body.externalId.trim() : ''
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!externalId) return NextResponse.json({ error: 'externalId is required' }, { status: 400 })
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })

  // Resolve the target doctor: an explicit doctorEmail wins; otherwise map the
  // source practiceKey via the practice map. Distinguish the failure modes so
  // the worker can react (quarantine vs create-the-account):
  //   409 unmapped practice  |  422 mapped/given email has no portal account
  const explicitEmail = typeof body.doctorEmail === 'string' ? body.doctorEmail.trim().toLowerCase() : ''
  const practiceKey = typeof body.practiceKey === 'string' ? body.practiceKey.trim() : ''
  const doctorEmail = explicitEmail || (practiceKey ? await resolvePracticeEmail(practiceKey) : null)
  if (!doctorEmail) {
    return NextResponse.json(
      { error: practiceKey ? `Unmapped practice '${practiceKey}'` : 'doctorEmail or a mapped practiceKey is required', reason: 'unmapped' },
      { status: 409 },
    )
  }

  // Idempotency: never create the same source case twice.
  const existing = await findCaseIdByExternalId(externalId)
  if (existing) {
    return NextResponse.json({ caseId: existing, created: false }, { status: 200 })
  }

  // Map the source practice to a portal doctor account.
  const doctor = await findDoctorByEmail(doctorEmail)
  if (!doctor) {
    return NextResponse.json(
      { error: `No portal account for ${doctorEmail} — create the doctor first`, reason: 'no_account' },
      { status: 422 },
    )
  }

  const caseType: CaseType = CASE_TYPES.includes(body.caseType as CaseType)
    ? (body.caseType as CaseType)
    : 'guide'

  const created = await addCase({
    doctorId: doctor.id,
    doctorName: doctor.name,
    title: title.slice(0, 200),
    patientName: typeof body.patientName === 'string' ? body.patientName.trim().slice(0, 200) : undefined,
    toothRef: typeof body.toothRef === 'string' ? body.toothRef.trim().slice(0, 100) : undefined,
    material: typeof body.material === 'string' ? body.material.trim().slice(0, 100) : undefined,
    scannerBrand: typeof body.scannerBrand === 'string' ? body.scannerBrand.trim().slice(0, 100) : undefined,
    scanCaseId: externalId, // stored so findCaseIdByExternalId stays idempotent
    specialInstructions:
      typeof body.specialInstructions === 'string' ? body.specialInstructions.trim().slice(0, 2000) : undefined,
    caseType,
    isRush: body.isRush === true,
  })

  // Attach the scan as the opening message (authored as the doctor, since the
  // scan came from their practice).
  const att = body.attachment
  if (att && typeof att.name === 'string' && (att.dataUrl || att.storageKey)) {
    await addMessage({
      caseId: created.id,
      authorId: doctor.id,
      authorName: doctor.name,
      authorRole: 'doctor',
      body: 'Scan received via automated intake.',
      attachments: [
        {
          name: att.name,
          mimeType: typeof att.mimeType === 'string' ? att.mimeType : '',
          size: typeof att.size === 'number' ? att.size : 0,
          dataUrl: att.dataUrl,
          storageKey: att.storageKey,
        },
      ],
    })
  }

  await recordAudit({
    actorId: null,
    actorRole: 'system',
    action: 'case.ingest',
    caseToken: created.id,
    detail: `${doctorEmail} ext:${externalId}`,
    ip: clientIp(request),
  })

  return NextResponse.json({ caseId: created.id, created: true }, { status: 201 })
}

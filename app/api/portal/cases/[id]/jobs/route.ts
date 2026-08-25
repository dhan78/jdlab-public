import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies, verifySessionToken } from '@/lib/portal-auth'
import { findCaseById } from '@/lib/case-store'
import { enqueueJobFromAttachment } from '@/lib/manufacturing-jobs'
import { recordAudit } from '@/lib/audit'
import { clientIp } from '@/lib/rate-limit'

// Queue an approved design attachment for manufacturing. Lab team only — the
// resulting job is served to the on-prem agent by /api/ingest/jobs.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const token = getSessionFromCookies(request.headers.get('cookie'))
  const session = token ? await verifySessionToken(token) : null
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  if (session.role !== 'planner' && session.role !== 'admin') {
    return NextResponse.json({ error: 'Only the lab team can queue manufacturing jobs' }, { status: 403 })
  }

  const caseRow = await findCaseById(id)
  if (!caseRow) {
    return NextResponse.json({ error: 'Case not found' }, { status: 404 })
  }

  let body: { attachmentId?: unknown; machine?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const attachmentId = Number(body.attachmentId)
  if (!Number.isInteger(attachmentId) || attachmentId <= 0) {
    return NextResponse.json({ error: 'attachmentId is required' }, { status: 400 })
  }
  const machine = typeof body.machine === 'string' ? body.machine.slice(0, 40) : null

  const result = await enqueueJobFromAttachment(id, attachmentId, { machine, createdBy: session.sub })
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  await recordAudit({
    actorId: session.sub,
    actorRole: session.role,
    action: 'job.enqueue',
    caseToken: id,
    detail: `job ${result.id} (${result.fileName})`,
    ip: clientIp(request),
  })

  return NextResponse.json({ job: result }, { status: 201 })
}

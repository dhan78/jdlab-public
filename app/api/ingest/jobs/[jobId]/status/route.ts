import { NextRequest, NextResponse } from 'next/server'
import { ingestAuthFailure } from '@/lib/ingest-auth'
import { updateJobStatus } from '@/lib/manufacturing-jobs'
import { recordAudit } from '@/lib/audit'
import { clientIp } from '@/lib/rate-limit'

// Status callback from the lab agent as it moves a job's file through the machine:
// dropped (into the hot folder), done (CAM/slicer finished), or error. Token-guarded
// like the rest of the ingest family. Advances the job and writes an audit row.

// The subset the agent reports back (queued is server-set at enqueue time).
type AgentStatus = 'dropped' | 'done' | 'error'
const AGENT_STATUSES = new Set<AgentStatus>(['dropped', 'done', 'error'])

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const denied = ingestAuthFailure(request)
  if (denied) return denied

  const { jobId } = await params
  const id = Number(jobId)
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid jobId' }, { status: 400 })
  }

  let body: { status?: unknown; detail?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const status = typeof body.status === 'string' ? (body.status as AgentStatus) : ('' as AgentStatus)
  if (!AGENT_STATUSES.has(status)) {
    return NextResponse.json(
      { error: `Invalid status; expected one of ${[...AGENT_STATUSES].join(', ')}` },
      { status: 400 },
    )
  }
  const detail = typeof body.detail === 'string' ? body.detail.slice(0, 500) : null

  const job = await updateJobStatus(id, status, detail)
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  await recordAudit({
    action: `job.${status}`,
    caseToken: job.caseId,
    detail: `job ${id} (${job.fileName})${detail ? `: ${detail}` : ''}`,
    ip: clientIp(request),
  })

  return NextResponse.json({ ok: true, jobId: String(id), status })
}

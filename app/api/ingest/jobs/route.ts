import { NextRequest, NextResponse } from 'next/server'
import { ingestAuthFailure } from '@/lib/ingest-auth'
import { listPendingJobs } from '@/lib/manufacturing-jobs'
import { getAttachmentUrl, isS3Enabled } from '@/lib/storage'

// Manufacturing job feed for the on-prem lab agent (see /lab-agent). Token-guarded
// (INGEST_API_TOKEN family) — NOT a doctor session. Returns the queued jobs the
// agent should drop into the CAM/slicer hot folder, each with a short-lived
// presigned downloadUrl, so no AWS credentials ever live on the lab PC. The agent
// reports progress via POST /api/ingest/jobs/[jobId]/status.

export interface PendingJob {
  jobId: string
  caseId: string | null
  fileName: string
  downloadUrl: string
}

export async function GET(request: NextRequest) {
  const denied = ingestAuthFailure(request)
  if (denied) return denied

  const status = new URL(request.url).searchParams.get('status') ?? 'pending'
  if (status !== 'pending') {
    return NextResponse.json({ error: `Unsupported status filter: ${status}` }, { status: 400 })
  }

  // Without S3 there's no way to hand the agent a download URL — idle cleanly.
  if (!isS3Enabled()) return NextResponse.json({ jobs: [] })

  const pending = await listPendingJobs()
  const jobs: PendingJob[] = await Promise.all(
    pending.map(async j => ({
      jobId: String(j.id),
      caseId: j.caseId,
      fileName: j.fileName,
      downloadUrl: await getAttachmentUrl(j.storageKey),
    })),
  )
  return NextResponse.json({ jobs })
}

// Manufacturing jobs: an approved case file queued for a machine and pulled by
// the on-prem lab agent (see /lab-agent) into a CAM/slicer hot folder. This is
// the source the token-guarded /api/ingest/jobs feed serves; the agent reports
// progress back via /api/ingest/jobs/[jobId]/status.
//
// Lifecycle: queued -> dropped (agent placed the file) -> done | error.

import { db } from './db'
import { manufacturingJobs, messageAttachments, caseMessages, cases } from './db/schema'
import { and, desc, eq } from 'drizzle-orm'
import { encodeCaseId, decodeCaseId } from './case-code'

export const JOB_STATUSES = ['queued', 'dropped', 'done', 'error'] as const
export type JobStatus = (typeof JOB_STATUSES)[number]

export interface ManufacturingJob {
  id: number
  caseId: string // encoded public case token
  attachmentId: number | null
  storageKey: string
  fileName: string
  machine: string | null
  status: JobStatus
  detail: string | null
  createdAt: string
  updatedAt: string
}

function toJob(row: typeof manufacturingJobs.$inferSelect): ManufacturingJob {
  return {
    id: row.id,
    caseId: encodeCaseId(row.caseId),
    attachmentId: row.attachmentId,
    storageKey: row.storageKey,
    fileName: row.fileName,
    machine: row.machine,
    status: row.status as JobStatus,
    detail: row.detail,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

// --- hot-folder filename: DL-0007__14__A2__crown.stl -----------------------
// Metadata-carrying so files are unique across cases and a CAM tech can read the
// case/tooth/shade at a glance. Every component is filesystem-sanitized.
const FS_UNSAFE = /[^A-Za-z0-9._-]+/g
function fsSafe(s: string): string {
  return s.trim().replace(FS_UNSAFE, '-').replace(/^-+|-+$/g, '')
}
function fsSafeFileName(originalName: string): string {
  const dot = originalName.lastIndexOf('.')
  const base = dot > 0 ? originalName.slice(0, dot) : originalName
  const ext = dot > 0 ? originalName.slice(dot) : ''
  return (fsSafe(base).slice(0, 80) || 'scan') + fsSafe(ext)
}
function caseNumberFor(id: number): string {
  return `DL-${String(id).padStart(4, '0')}`
}
function buildJobFileName(
  caseId: number,
  jobId: number,
  toothRef: string | null,
  shade: string | null,
  originalName: string,
): string {
  const prefix = [caseNumberFor(caseId), toothRef, shade]
    .map(p => (p ? fsSafe(p) : ''))
    .filter(Boolean)
    .join('__')
  return `${prefix}__j${jobId}__${fsSafeFileName(originalName)}`
}

// Queue an approved attachment for manufacturing. The attachment must belong to
// the case and be S3-backed (a dataUrl-only dev attachment can't be handed to a
// machine). Returns the job, or an { error } the caller maps to a 400.
export async function enqueueJobFromAttachment(
  caseToken: string,
  attachmentId: number,
  opts?: { machine?: string | null; createdBy?: string | number | null },
): Promise<ManufacturingJob | { error: string }> {
  const cid = decodeCaseId(caseToken)
  if (cid <= 0) return { error: 'Unknown case' }

  const [caseRow] = await db
    .select({ id: cases.id, toothRef: cases.toothRef, shade: cases.shade })
    .from(cases)
    .where(eq(cases.id, cid))
    .limit(1)
  if (!caseRow) return { error: 'Unknown case' }

  const [att] = await db
    .select({
      id: messageAttachments.id,
      name: messageAttachments.name,
      storageKey: messageAttachments.storageKey,
    })
    .from(messageAttachments)
    .innerJoin(caseMessages, eq(messageAttachments.messageId, caseMessages.id))
    .where(and(eq(messageAttachments.id, attachmentId), eq(caseMessages.caseId, cid)))
    .limit(1)

  if (!att) return { error: 'Attachment not found on this case' }
  const storageKey = att.storageKey
  if (!storageKey) return { error: 'Attachment has no stored file to manufacture' }

  const createdByNum =
    opts?.createdBy != null && Number.isInteger(Number(opts.createdBy)) ? Number(opts.createdBy) : null

  // The job id is part of the hot-folder filename (bulletproof uniqueness), so
  // insert then set fileName from the returned id — atomically, so a concurrent
  // agent poll can never see the pre-named row.
  const row = await db.transaction(async tx => {
    const [inserted] = await tx
      .insert(manufacturingJobs)
      .values({
        caseId: cid,
        attachmentId: att.id,
        storageKey,
        fileName: 'pending',
        machine: opts?.machine ?? null,
        createdBy: createdByNum,
      })
      .returning()
    const fileName = buildJobFileName(caseRow.id, inserted.id, caseRow.toothRef, caseRow.shade, att.name)
    const [updated] = await tx
      .update(manufacturingJobs)
      .set({ fileName })
      .where(eq(manufacturingJobs.id, inserted.id))
      .returning()
    return updated
  })
  return toJob(row)
}

// Jobs the agent should pick up next (not yet dropped), oldest first.
export async function listPendingJobs(): Promise<ManufacturingJob[]> {
  const rows = await db
    .select()
    .from(manufacturingJobs)
    .where(eq(manufacturingJobs.status, 'queued'))
    .orderBy(desc(manufacturingJobs.createdAt))
  return rows.map(toJob)
}

export async function getJobById(jobId: number): Promise<ManufacturingJob | undefined> {
  const [row] = await db.select().from(manufacturingJobs).where(eq(manufacturingJobs.id, jobId)).limit(1)
  return row ? toJob(row) : undefined
}

export async function updateJobStatus(
  jobId: number,
  status: JobStatus,
  detail?: string | null,
): Promise<ManufacturingJob | undefined> {
  const [row] = await db
    .update(manufacturingJobs)
    .set({ status, detail: detail ?? null, updatedAt: new Date() })
    .where(eq(manufacturingJobs.id, jobId))
    .returning()
  return row ? toJob(row) : undefined
}

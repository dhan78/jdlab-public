import { db } from './db'
import { cases, caseMessages, messageAttachments, caseStatusHistory, users, caseReads } from './db/schema'
import { and, asc, desc, eq, gt, inArray, isNull, or, sql } from 'drizzle-orm'
import { encodeCaseId, decodeCaseId } from './case-code'
import { isS3Enabled, putAttachment, getAttachmentUrl, parseDataUrl } from './storage'
import type { CaseStatus, CaseType } from './case-meta'

// Re-export the shared metadata so existing imports from '@/lib/case-store' keep working.
export type { CaseStatus, CaseType } from './case-meta'
export {
  CASE_STATUSES,
  CASE_STATUS_LABELS,
  CASE_TYPES,
  CASE_TYPE_LABELS,
  STAGES_BY_TYPE,
} from './case-meta'

export interface CaseAttachment {
  id: string
  name: string
  mimeType: string
  size: number
  dataUrl: string
}

export interface CaseMessage {
  id: string
  caseId: string
  authorId: string | null
  authorName: string
  authorRole: 'doctor' | 'planner' | 'admin'
  body: string
  attachments: CaseAttachment[]
  createdAt: string
}

export interface Case {
  id: string
  caseNumber: string
  doctorId: string
  doctorName: string
  title: string
  patientName?: string
  surgeryDate?: string
  toothRef?: string
  material?: string
  scannerBrand?: string
  scanCaseId?: string
  scanLink?: string
  specialInstructions?: string
  shipToAddress?: string
  caseType: CaseType
  isRush: boolean
  status: CaseStatus
  scanReceivedAt?: string
  createdAt: string
  updatedAt: string
}

type CaseRow = typeof cases.$inferSelect

// NaN-safe int for WHERE clauses (returns -1 -> matches nothing).
function toIntId(v: string | number): number {
  const n = typeof v === 'number' ? v : parseInt(v, 10)
  return Number.isInteger(n) ? n : -1
}
// For nullable FK inserts: invalid/stale ids become null instead of violating FK.
function toIntOrNull(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null
  const n = typeof v === 'number' ? v : parseInt(v, 10)
  return Number.isInteger(n) ? n : null
}

// Friendly, sequential case label derived from the integer id.
function caseNumberFor(id: number): string {
  return `DL-${String(id).padStart(4, '0')}`
}

function mapCase(row: CaseRow, doctorName: string): Case {
  return {
    id: encodeCaseId(row.id),
    caseNumber: caseNumberFor(row.id),
    doctorId: String(row.doctorId),
    doctorName,
    title: row.title,
    patientName: row.patientName ?? undefined,
    surgeryDate: row.surgeryDate ?? undefined,
    toothRef: row.toothRef ?? undefined,
    material: row.material ?? undefined,
    scannerBrand: row.scannerBrand ?? undefined,
    scanCaseId: row.scanCaseId ?? undefined,
    scanLink: row.scanLink ?? undefined,
    specialInstructions: row.specialInstructions ?? undefined,
    shipToAddress: row.shipToAddress ?? undefined,
    caseType: (row.caseType as CaseType) ?? 'guide',
    isRush: row.isRush,
    status: row.status as CaseStatus,
    scanReceivedAt: row.scanReceivedAt?.toISOString() ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

// --- Case CRUD ---

export async function addCase(input: {
  doctorId: string
  doctorName: string
  title: string
  patientName?: string
  surgeryDate?: string
  toothRef?: string
  material?: string
  scannerBrand?: string
  scanCaseId?: string
  scanLink?: string
  specialInstructions?: string
  shipToAddress?: string
  caseType?: CaseType
  isRush?: boolean
}): Promise<Case> {
  const doctorId = toIntId(input.doctorId)
  const [row] = await db
    .insert(cases)
    .values({
      doctorId,
      title: input.title,
      patientName: input.patientName ?? null,
      surgeryDate: input.surgeryDate ?? null,
      toothRef: input.toothRef ?? null,
      material: input.material ?? null,
      scannerBrand: input.scannerBrand ?? null,
      scanCaseId: input.scanCaseId ?? null,
      scanLink: input.scanLink ?? null,
      specialInstructions: input.specialInstructions ?? null,
      shipToAddress: input.shipToAddress ?? null,
      caseType: input.caseType ?? 'guide',
      isRush: input.isRush ?? false,
      status: 'received',
    })
    .returning()

  await db.insert(caseStatusHistory).values({
    caseId: row.id,
    fromStatus: null,
    toStatus: 'received',
    changedBy: toIntOrNull(input.doctorId),
  })

  return mapCase(row, input.doctorName)
}

export async function findCaseById(id: string): Promise<Case | undefined> {
  const [r] = await db
    .select({ c: cases, doctorName: users.name })
    .from(cases)
    .innerJoin(users, eq(cases.doctorId, users.id))
    .where(eq(cases.id, decodeCaseId(id)))
    .limit(1)
  return r ? mapCase(r.c, r.doctorName) : undefined
}

export async function listAllCases(): Promise<Case[]> {
  const rows = await db
    .select({ c: cases, doctorName: users.name })
    .from(cases)
    .innerJoin(users, eq(cases.doctorId, users.id))
    .orderBy(desc(cases.updatedAt))
  return rows.map(r => mapCase(r.c, r.doctorName))
}

export async function listCasesForDoctor(doctorId: string): Promise<Case[]> {
  const rows = await db
    .select({ c: cases, doctorName: users.name })
    .from(cases)
    .innerJoin(users, eq(cases.doctorId, users.id))
    .where(eq(cases.doctorId, toIntId(doctorId)))
    .orderBy(desc(cases.updatedAt))
  return rows.map(r => mapCase(r.c, r.doctorName))
}

export async function updateCaseStatus(
  id: string,
  status: CaseStatus,
  changedBy?: string
): Promise<Case | undefined> {
  const caseId = decodeCaseId(id)
  const [existing] = await db.select().from(cases).where(eq(cases.id, caseId)).limit(1)
  if (!existing) return undefined

  // Advancing past "received" implies the lab has the scans, so start the SLA
  // clock if it wasn't set manually — a case can't be in design/production
  // while still "awaiting scan".
  const startsClock = status !== 'received' && !existing.scanReceivedAt
  const [row] = await db
    .update(cases)
    .set({
      status,
      updatedAt: new Date(),
      ...(startsClock ? { scanReceivedAt: new Date() } : {}),
    })
    .where(eq(cases.id, caseId))
    .returning()

  await db.insert(caseStatusHistory).values({
    caseId,
    fromStatus: existing.status,
    toStatus: status,
    changedBy: toIntOrNull(changedBy),
  })

  const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, row.doctorId)).limit(1)
  return mapCase(row, u?.name ?? '')
}

// Start/stop the SLA clock: stamp (or clear) when the lab received the scans.
export async function setScanReceived(id: string, received: boolean): Promise<void> {
  const caseId = decodeCaseId(id)
  if (caseId < 0) return
  await db
    .update(cases)
    .set({ scanReceivedAt: received ? new Date() : null, updatedAt: new Date() })
    .where(eq(cases.id, caseId))
}

// --- Messages ---

type AttachmentRow = typeof messageAttachments.$inferSelect

// Presign S3-backed attachments; fall back to the stored base64 data URL.
async function mapAttachment(row: AttachmentRow): Promise<CaseAttachment> {
  const dataUrl = row.storageKey ? await getAttachmentUrl(row.storageKey) : row.dataUrl ?? ''
  return {
    id: String(row.id),
    name: row.name,
    mimeType: row.mimeType,
    size: row.sizeBytes,
    dataUrl,
  }
}

// Batched message counts for a set of cases (avoids N+1 when listing).
export async function messageCountsByCase(caseIds: string[]): Promise<Record<string, number>> {
  const ints = caseIds.map(decodeCaseId).filter(n => n > 0)
  if (ints.length === 0) return {}
  const rows = await db
    .select({ caseId: caseMessages.caseId, count: sql<number>`count(*)::int` })
    .from(caseMessages)
    .where(inArray(caseMessages.caseId, ints))
    .groupBy(caseMessages.caseId)
  const out: Record<string, number> = {}
  for (const r of rows) out[encodeCaseId(r.caseId)] = r.count
  return out
}

export async function listMessagesForCase(caseId: string): Promise<CaseMessage[]> {
  const cid = decodeCaseId(caseId)
  const msgs = await db
    .select()
    .from(caseMessages)
    .where(eq(caseMessages.caseId, cid))
    .orderBy(asc(caseMessages.createdAt))

  if (msgs.length === 0) return []

  const atts = await db
    .select()
    .from(messageAttachments)
    .where(inArray(messageAttachments.messageId, msgs.map(m => m.id)))

  const byMessage = new Map<string, CaseAttachment[]>()
  const pairs = await Promise.all(
    atts.map(async a => [a.messageId, await mapAttachment(a)] as const)
  )
  for (const [messageId, ca] of pairs) {
    const list = byMessage.get(messageId) ?? []
    list.push(ca)
    byMessage.set(messageId, list)
  }

  return msgs.map(m => ({
    id: m.id,
    caseId: encodeCaseId(m.caseId),
    authorId: m.authorId != null ? String(m.authorId) : null,
    authorName: m.authorName,
    authorRole: m.authorRole as CaseMessage['authorRole'],
    body: m.body,
    attachments: byMessage.get(m.id) ?? [],
    createdAt: m.createdAt.toISOString(),
  }))
}

// --- Read state / unread counts ---

// Record that a user has read a case up to now (upsert).
export async function markCaseRead(userId: string, caseId: string): Promise<void> {
  const uid = toIntId(userId)
  const cid = decodeCaseId(caseId)
  if (uid < 0 || cid < 0) return
  await db
    .insert(caseReads)
    .values({ userId: uid, caseId: cid, lastReadAt: new Date(), flagged: false })
    .onConflictDoUpdate({
      target: [caseReads.userId, caseReads.caseId],
      set: { lastReadAt: new Date(), flagged: false },
    })
}

// Mark a case unread for a user by setting a manual follow-up flag (works even
// when there are no messages from others yet). If there IS a later message from
// someone else, also rewind last_read_at to just before it so the real unread
// reply count is restored.
export async function markCaseUnread(userId: string, caseId: string): Promise<boolean> {
  const uid = toIntId(userId)
  const cid = decodeCaseId(caseId)
  if (uid < 0 || cid < 0) return false

  const [latest] = await db
    .select({ createdAt: caseMessages.createdAt })
    .from(caseMessages)
    .where(and(eq(caseMessages.caseId, cid), sql`${caseMessages.authorId} is distinct from ${uid}`))
    .orderBy(desc(caseMessages.createdAt))
    .limit(1)

  const lastReadAt = latest ? new Date(latest.createdAt.getTime() - 1) : new Date()
  await db
    .insert(caseReads)
    .values({ userId: uid, caseId: cid, lastReadAt, flagged: true })
    .onConflictDoUpdate({
      target: [caseReads.userId, caseReads.caseId],
      set: { lastReadAt, flagged: true },
    })
  return true
}

// Unread messages per case for a user: messages authored by someone else, newer
// than the user's last read (or all, if never read). Returns { [encodedId]: count }.
export async function getUnreadCounts(
  userId: string,
  role: 'doctor' | 'planner' | 'admin'
): Promise<Record<string, number>> {
  const uid = toIntId(userId)
  if (uid < 0) return {}

  const rows = await db
    .select({
      caseId: cases.id,
      unread: sql<number>`count(${caseMessages.id})::int`,
    })
    .from(cases)
    .innerJoin(caseMessages, eq(caseMessages.caseId, cases.id))
    .leftJoin(
      caseReads,
      and(eq(caseReads.caseId, cases.id), eq(caseReads.userId, uid))
    )
    .where(
      and(
        role === 'doctor' ? eq(cases.doctorId, uid) : undefined,
        or(isNull(caseReads.lastReadAt), gt(caseMessages.createdAt, caseReads.lastReadAt)),
        sql`${caseMessages.authorId} is distinct from ${uid}`
      )
    )
    .groupBy(cases.id)

  const out: Record<string, number> = {}
  for (const r of rows) out[encodeCaseId(r.caseId)] = Number(r.unread)

  // Manually flagged cases count as unread (at least 1) even with no unread reply.
  const flaggedRows = await db
    .select({ caseId: caseReads.caseId })
    .from(caseReads)
    .innerJoin(cases, eq(cases.id, caseReads.caseId))
    .where(
      and(
        eq(caseReads.userId, uid),
        eq(caseReads.flagged, true),
        role === 'doctor' ? eq(cases.doctorId, uid) : undefined
      )
    )
  for (const r of flaggedRows) {
    const key = encodeCaseId(r.caseId)
    out[key] = Math.max(out[key] ?? 0, 1)
  }
  return out
}

// When a user last opened each case they've viewed. Backs the sidebar's
// "recently viewed" ordering. Returns { [encodedCaseId]: ISO } — cases the
// user has never opened are absent.
export async function getLastViewedMap(userId: string): Promise<Record<string, string>> {
  const uid = toIntId(userId)
  if (uid < 0) return {}

  const rows = await db
    .select({ caseId: caseReads.caseId, lastReadAt: caseReads.lastReadAt })
    .from(caseReads)
    .where(eq(caseReads.userId, uid))

  const out: Record<string, string> = {}
  for (const r of rows) out[encodeCaseId(r.caseId)] = r.lastReadAt.toISOString()
  return out
}

export async function addMessage(input: {
  caseId: string
  authorId: string | null
  authorName: string
  authorRole: 'doctor' | 'planner' | 'admin'
  body: string
  attachments: CaseAttachment[]
}): Promise<CaseMessage> {
  const caseId = decodeCaseId(input.caseId)

  // Per-case sequence -> message id "{caseId}-{n}".
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(caseMessages)
    .where(eq(caseMessages.caseId, caseId))
  const messageId = `${caseId}-${(n ?? 0) + 1}`

  const [msg] = await db
    .insert(caseMessages)
    .values({
      id: messageId,
      caseId,
      authorId: toIntOrNull(input.authorId),
      authorName: input.authorName,
      authorRole: input.authorRole,
      body: input.body,
    })
    .returning()

  let attachments: CaseAttachment[] = []
  if (input.attachments.length > 0) {
    // Upload to S3 when configured; otherwise persist the base64 data URL.
    const values = await Promise.all(
      input.attachments.map(async a => {
        const base = { messageId: msg.id, name: a.name, mimeType: a.mimeType, sizeBytes: a.size }
        if (isS3Enabled()) {
          const parsed = parseDataUrl(a.dataUrl)
          if (parsed) {
            const key = await putAttachment(parsed.bytes, parsed.mimeType || a.mimeType, a.name)
            return { ...base, storageKey: key, dataUrl: null }
          }
        }
        return { ...base, storageKey: null, dataUrl: a.dataUrl }
      })
    )
    const inserted = await db.insert(messageAttachments).values(values).returning()
    attachments = await Promise.all(inserted.map(mapAttachment))
  }

  // Posting a message bumps the case so it rises in the queue/list.
  await db.update(cases).set({ updatedAt: new Date() }).where(eq(cases.id, caseId))

  return {
    id: msg.id,
    caseId: encodeCaseId(msg.caseId),
    authorId: msg.authorId != null ? String(msg.authorId) : null,
    authorName: msg.authorName,
    authorRole: msg.authorRole as CaseMessage['authorRole'],
    body: msg.body,
    attachments,
    createdAt: msg.createdAt.toISOString(),
  }
}

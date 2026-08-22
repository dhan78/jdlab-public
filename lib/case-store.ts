import { db } from './db'
import { cases, caseMessages, messageAttachments, caseStatusHistory, users, caseReads, auditLog, caseAnnotations } from './db/schema'
import { and, asc, desc, eq, gt, inArray, isNull, isNotNull, or, sql } from 'drizzle-orm'
import { encodeCaseId, decodeCaseId } from './case-code'
import { isS3Enabled, putAttachment, getAttachmentUrl, parseDataUrl, deleteCaseAttachments, deleteScanArtifacts } from './storage'
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

// Fill in / edit the doctor-editable detail fields (used when the doctor
// completes an auto-ingested case that arrived with only a scan). Only keys
// present in `fields` are changed; a field set to null clears it. Status and
// scan-receipt live on their own update paths.
export async function updateCaseDetails(
  id: string,
  fields: {
    title?: string
    patientName?: string | null
    surgeryDate?: string | null
    toothRef?: string | null
    material?: string | null
    scannerBrand?: string | null
    specialInstructions?: string | null
    shipToAddress?: string | null
    caseType?: CaseType
    isRush?: boolean
  }
): Promise<Case | undefined> {
  const set: Partial<typeof cases.$inferInsert> = { updatedAt: new Date() }
  if (fields.title !== undefined) set.title = fields.title
  if (fields.patientName !== undefined) set.patientName = fields.patientName
  if (fields.surgeryDate !== undefined) set.surgeryDate = fields.surgeryDate
  if (fields.toothRef !== undefined) set.toothRef = fields.toothRef
  if (fields.material !== undefined) set.material = fields.material
  if (fields.scannerBrand !== undefined) set.scannerBrand = fields.scannerBrand
  if (fields.specialInstructions !== undefined) set.specialInstructions = fields.specialInstructions
  if (fields.shipToAddress !== undefined) set.shipToAddress = fields.shipToAddress
  if (fields.caseType !== undefined) set.caseType = fields.caseType
  if (fields.isRush !== undefined) set.isRush = fields.isRush

  const [row] = await db.update(cases).set(set).where(eq(cases.id, decodeCaseId(id))).returning()
  if (!row) return undefined
  const [d] = await db.select({ name: users.name }).from(users).where(eq(users.id, row.doctorId)).limit(1)
  return mapCase(row, d?.name ?? '')
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

// Look up a case by its external/source id (stored in scan_case_id). Used by the
// automated ingestion pipeline to stay idempotent — never create the same
// source case twice. Returns the public (encoded) case id if it exists.
export async function findCaseIdByExternalId(externalId: string): Promise<string | undefined> {
  if (!externalId) return undefined
  const [row] = await db
    .select({ id: cases.id })
    .from(cases)
    .where(eq(cases.scanCaseId, externalId))
    .limit(1)
  return row ? encodeCaseId(row.id) : undefined
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

  // Sourced from the audit trail's `case.view` records (written on every case
  // open) rather than case_reads.last_read_at: opening a case no longer marks it
  // read, so read time is no longer a proxy for "viewed".
  const rows = await db
    .select({ caseId: auditLog.caseId, viewedAt: sql<string>`max(${auditLog.createdAt})` })
    .from(auditLog)
    .where(and(eq(auditLog.actorId, uid), eq(auditLog.action, 'case.view')))
    .groupBy(auditLog.caseId)

  const out: Record<string, string> = {}
  for (const r of rows) {
    if (r.caseId == null) continue
    out[encodeCaseId(r.caseId)] = new Date(r.viewedAt).toISOString()
  }
  return out
}

// --- Pins (manual "keep this case in the recently-viewed rail") ---

// Pin or unpin a case for a user (upsert). Pinning a case the user has no read
// row for inserts one with last_read_at at the epoch, so pinning never marks the
// case read (its unread state is preserved).
export async function setPinned(userId: string, caseId: string, pinned: boolean): Promise<void> {
  const uid = toIntId(userId)
  const cid = decodeCaseId(caseId)
  if (uid < 0 || cid < 0) return
  if (pinned) {
    await db
      .insert(caseReads)
      .values({ userId: uid, caseId: cid, pinnedAt: new Date(), lastReadAt: new Date(0) })
      .onConflictDoUpdate({
        target: [caseReads.userId, caseReads.caseId],
        set: { pinnedAt: new Date() },
      })
  } else {
    await db
      .update(caseReads)
      .set({ pinnedAt: null })
      .where(and(eq(caseReads.userId, uid), eq(caseReads.caseId, cid)))
  }
}

// Encoded case ids the user has pinned.
export async function getPinnedSet(userId: string): Promise<Set<string>> {
  const uid = toIntId(userId)
  if (uid < 0) return new Set()
  const rows = await db
    .select({ caseId: caseReads.caseId })
    .from(caseReads)
    .where(and(eq(caseReads.userId, uid), isNotNull(caseReads.pinnedAt)))
  return new Set(rows.map(r => encodeCaseId(r.caseId)))
}

// Encoded case id -> pinned-at ISO time. Lets the UI order pinned cases by a
// STABLE pin time (spatial memory) rather than by view recency.
export async function getPinnedMap(userId: string): Promise<Record<string, string>> {
  const uid = toIntId(userId)
  if (uid < 0) return {}
  const rows = await db
    .select({ caseId: caseReads.caseId, pinnedAt: caseReads.pinnedAt })
    .from(caseReads)
    .where(and(eq(caseReads.userId, uid), isNotNull(caseReads.pinnedAt)))
  const out: Record<string, string> = {}
  for (const r of rows) {
    if (r.pinnedAt) out[encodeCaseId(r.caseId)] = new Date(r.pinnedAt).toISOString()
  }
  return out
}

// Whether a single case is pinned by a user (targeted lookup for case detail).
export async function isCasePinned(userId: string, caseId: string): Promise<boolean> {
  const uid = toIntId(userId)
  const cid = decodeCaseId(caseId)
  if (uid < 0 || cid < 0) return false
  const [row] = await db
    .select({ pinnedAt: caseReads.pinnedAt })
    .from(caseReads)
    .where(and(eq(caseReads.userId, uid), eq(caseReads.caseId, cid)))
    .limit(1)
  return !!row?.pinnedAt
}

// Delete a case and its cascading children. Used to roll back an ingest that
// created the case but then failed to copy/attach its scan, so a retry stays clean.
export async function deleteCase(caseId: string): Promise<void> {
  const cid = decodeCaseId(caseId)
  if (cid < 0) return
  await db.delete(cases).where(eq(cases.id, cid))
}

// Admin hard-delete: wipe the case, its thread + status history (DB cascade),
// ALL S3 attachments, and the source raw scan + GLB previews — so no storage is
// left anywhere in AWS. S3 is cleared first (idempotent) so a failure leaves the
// DB row intact for a retry. Returns null if the case doesn't exist.
export async function purgeCase(
  caseId: string
): Promise<{ attachmentsDeleted: number; scanObjectsDeleted: number } | null> {
  const cid = decodeCaseId(caseId)
  if (cid < 0) return null
  const [row] = await db.select().from(cases).where(eq(cases.id, cid)).limit(1)
  if (!row) return null
  const attachmentsDeleted = isS3Enabled() ? await deleteCaseAttachments(caseId) : 0
  const scanObjectsDeleted = await deleteScanArtifacts(row.scanCaseId)
  await db.delete(cases).where(eq(cases.id, cid))
  return { attachmentsDeleted, scanObjectsDeleted }
}

// --- 3D surface annotations (pins on a specific model attachment) ---

export interface CaseAnnotation {
  id: string
  attachmentId: string | null
  previewKey: string | null
  kind: string // 'pin' | 'measure'
  x: number
  y: number
  z: number
  bx: number | null
  by: number | null
  bz: number | null
  body: string
  authorId: string | null
  authorName: string
  authorRole: string
  createdAt: string
}

function mapAnnotation(r: typeof caseAnnotations.$inferSelect): CaseAnnotation {
  return {
    id: String(r.id),
    attachmentId: r.attachmentId != null ? String(r.attachmentId) : null,
    previewKey: r.previewKey ?? null,
    kind: r.kind,
    x: r.x,
    y: r.y,
    z: r.z,
    bx: r.bx,
    by: r.by,
    bz: r.bz,
    body: r.body,
    authorId: r.authorId != null ? String(r.authorId) : null,
    authorName: r.authorName,
    authorRole: r.authorRole,
    createdAt: new Date(r.createdAt).toISOString(),
  }
}

// All annotations for a case (across every model attachment), oldest first so
// the numbered badges are stable.
export async function listCaseAnnotations(caseId: string): Promise<CaseAnnotation[]> {
  const cid = decodeCaseId(caseId)
  if (cid < 0) return []
  const rows = await db
    .select()
    .from(caseAnnotations)
    .where(eq(caseAnnotations.caseId, cid))
    .orderBy(asc(caseAnnotations.createdAt))
  return rows.map(mapAnnotation)
}

// Create a pin/measurement. It anchors to EITHER a model attachment (verified to
// belong to this case) OR a GLB preview key (the caller validates it belongs to
// the case, since previews are resolved from S3, not stored rows). Returns null
// if an attachment anchor doesn't belong to the case.
export async function createCaseAnnotation(
  caseId: string,
  input: {
    attachmentId?: string
    previewKey?: string
    kind?: string
    x: number
    y: number
    z: number
    bx?: number | null
    by?: number | null
    bz?: number | null
    body: string
    authorId: string | null
    authorName: string
    authorRole: string
  }
): Promise<CaseAnnotation | null> {
  const cid = decodeCaseId(caseId)
  if (cid < 0) return null
  let aid: number | null = null
  let previewKey: string | null = null
  if (input.previewKey) {
    previewKey = input.previewKey.slice(0, 512)
  } else {
    aid = toIntId(input.attachmentId ?? '')
    if (aid < 0) return null
    const [owner] = await db
      .select({ id: messageAttachments.id })
      .from(messageAttachments)
      .innerJoin(caseMessages, eq(messageAttachments.messageId, caseMessages.id))
      .where(and(eq(messageAttachments.id, aid), eq(caseMessages.caseId, cid)))
      .limit(1)
    if (!owner) return null
  }
  const uid = input.authorId != null ? toIntId(input.authorId) : -1
  const [row] = await db
    .insert(caseAnnotations)
    .values({
      caseId: cid,
      attachmentId: aid,
      previewKey,
      kind: input.kind === 'measure' ? 'measure' : 'pin',
      x: input.x,
      y: input.y,
      z: input.z,
      bx: input.bx ?? null,
      by: input.by ?? null,
      bz: input.bz ?? null,
      body: input.body.slice(0, 500),
      authorId: uid >= 0 ? uid : null,
      authorName: input.authorName,
      authorRole: input.authorRole,
    })
    .returning()
  return mapAnnotation(row)
}

// Delete a pin. Author may delete their own; admins may delete any. Returns
// true if a row was removed (false = not found or not permitted).
export async function deleteCaseAnnotation(
  caseId: string,
  annotationId: string,
  requesterId: string,
  requesterRole: string
): Promise<boolean> {
  const cid = decodeCaseId(caseId)
  const id = toIntId(annotationId)
  const uid = toIntId(requesterId)
  if (cid < 0 || id < 0) return false
  const where =
    requesterRole === 'admin'
      ? and(eq(caseAnnotations.id, id), eq(caseAnnotations.caseId, cid))
      : and(eq(caseAnnotations.id, id), eq(caseAnnotations.caseId, cid), eq(caseAnnotations.authorId, uid))
  const removed = await db.delete(caseAnnotations).where(where).returning({ id: caseAnnotations.id })
  return removed.length > 0
}

export async function addMessage(input: {
  caseId: string
  authorId: string | null
  authorName: string
  authorRole: 'doctor' | 'planner' | 'admin'
  body: string
  attachments: Array<{ name: string; mimeType: string; size: number; dataUrl?: string; storageKey?: string }>
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
        // Already uploaded directly to S3 (presigned PUT) — store the key as-is.
        if (a.storageKey) {
          return { ...base, storageKey: a.storageKey, dataUrl: null }
        }
        // Inline base64: upload to S3 when configured, else persist the data URL.
        if (isS3Enabled() && a.dataUrl) {
          const parsed = parseDataUrl(a.dataUrl)
          if (parsed) {
            const key = await putAttachment(parsed.bytes, parsed.mimeType || a.mimeType, a.name, {
              caseId: input.caseId,
            })
            return { ...base, storageKey: key, dataUrl: null }
          }
        }
        return { ...base, storageKey: null, dataUrl: a.dataUrl ?? null }
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

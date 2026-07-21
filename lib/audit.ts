/**
 * Security/compliance audit trail. Records who did what, when, and from where.
 *
 * Writes are best-effort and never throw — auditing must not break the primary
 * request. For PHI systems this table is the backbone of access accountability.
 */
import { db } from './db'
import { auditLog } from './db/schema'
import { decodeCaseId } from './case-code'

export type AuditAction =
  | 'login.success'
  | 'login.failure'
  | 'logout'
  | 'case.view'
  | 'case.create'
  | 'case.status_change'
  | 'case.scan_received'
  | 'message.create'
  | 'doctor.create'
  | 'doctor.delete'
  | 'sla.update'
  | 'password.reset_request'
  | 'password.reset_complete'

function toIntOrNull(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null
  const n = typeof v === 'number' ? v : parseInt(v, 10)
  return Number.isInteger(n) ? n : null
}

export async function recordAudit(input: {
  actorId?: string | number | null
  actorRole?: string | null
  action: AuditAction
  /** Public case token or internal id; decoded to the internal id. */
  caseToken?: string | null
  detail?: string
  ip?: string
}): Promise<void> {
  try {
    const caseId =
      input.caseToken != null ? (decodeCaseId(input.caseToken) > 0 ? decodeCaseId(input.caseToken) : null) : null
    await db.insert(auditLog).values({
      actorId: toIntOrNull(input.actorId),
      actorRole: input.actorRole ?? null,
      action: input.action,
      caseId,
      detail: input.detail ?? null,
      ip: input.ip ?? null,
    })
  } catch (err) {
    console.error('[audit] failed to record', input.action, err)
  }
}

import { timingSafeEqual } from 'node:crypto'

// Pure, HTTP-independent result of checking an ingestion bearer token, so the
// constant-time comparison can be unit-tested without the Next request layer.
export type IngestTokenResult = 'ok' | 'not_configured' | 'invalid'

/** Constant-time check of an `Authorization: Bearer <token>` header against the
 *  configured token. `not_configured` = feature off (no server token). */
export function checkIngestToken(
  expected: string | undefined | null,
  authHeader: string | null | undefined
): IngestTokenResult {
  if (!expected) return 'not_configured'
  const provided =
    authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return 'invalid'
  return 'ok'
}

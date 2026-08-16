import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'

// Shared bearer-token guard for the token-authenticated ingestion routes
// (/api/ingest/cases, /api/ingest/upload-url). One source of truth so the two
// endpoints can't drift. Returns 503 if the server has no token configured
// (feature off), 401 on mismatch, null when authorized.
export function ingestAuthFailure(request: NextRequest): NextResponse | null {
  const expected = process.env.INGEST_API_TOKEN
  if (!expected) {
    return NextResponse.json({ error: 'Ingestion is not configured' }, { status: 503 })
  }
  const header = request.headers.get('authorization') ?? ''
  const provided = header.startsWith('Bearer ') ? header.slice(7) : ''
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Invalid ingestion token' }, { status: 401 })
  }
  return null
}

import { NextRequest, NextResponse } from 'next/server'
import { checkIngestToken } from './ingest-token'

// Shared bearer-token guard for the token-authenticated ingestion routes
// (/api/ingest/cases, /api/ingest/upload-url, /api/ingest/copy-scan). One source
// of truth so the endpoints can't drift. Returns 503 if the server has no token
// configured (feature off), 401 on mismatch, null when authorized.
export function ingestAuthFailure(request: NextRequest): NextResponse | null {
  const result = checkIngestToken(process.env.INGEST_API_TOKEN, request.headers.get('authorization'))
  if (result === 'not_configured') {
    return NextResponse.json({ error: 'Ingestion is not configured' }, { status: 503 })
  }
  if (result === 'invalid') {
    return NextResponse.json({ error: 'Invalid ingestion token' }, { status: 401 })
  }
  return null
}

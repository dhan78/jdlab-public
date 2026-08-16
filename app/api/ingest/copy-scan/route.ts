import { NextRequest, NextResponse } from 'next/server'
import { ingestAuthFailure } from '@/lib/ingest-auth'
import { copyIntoAttachments, isS3Enabled } from '@/lib/storage'

// Server-side copy of an already-uploaded scan object (in S3 under scans/raw/)
// into the portal's attachment key space, so the ingestion worker never has to
// download + re-upload a large scan. The source is validated against
// SCAN_BUCKET + SCAN_RAW_PREFIX so the token can't copy arbitrary objects.
export async function POST(request: NextRequest) {
  const denied = ingestAuthFailure(request)
  if (denied) return denied

  if (!isS3Enabled()) {
    return NextResponse.json({ error: 'S3 storage is not configured' }, { status: 503 })
  }

  let body: { sourceBucket?: unknown; sourceKey?: unknown; name?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const sourceBucket = typeof body.sourceBucket === 'string' ? body.sourceBucket : ''
  const sourceKey = typeof body.sourceKey === 'string' ? body.sourceKey : ''
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'scan.bin'
  if (!sourceBucket || !sourceKey) {
    return NextResponse.json({ error: 'sourceBucket and sourceKey are required' }, { status: 400 })
  }

  // Only allow copying from the configured scan bucket + raw prefix.
  const allowedBucket = process.env.SCAN_BUCKET
  const rawPrefix = (process.env.SCAN_RAW_PREFIX ?? 'scans/raw/').replace(/^\/+/, '')
  if (!allowedBucket || sourceBucket !== allowedBucket || !sourceKey.startsWith(rawPrefix)) {
    return NextResponse.json({ error: 'source not allowed' }, { status: 403 })
  }

  try {
    const key = await copyIntoAttachments(sourceBucket, sourceKey, name)
    return NextResponse.json({ key }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'copy failed' }, { status: 502 })
  }
}

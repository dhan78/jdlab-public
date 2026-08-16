import { NextRequest, NextResponse } from 'next/server'
import { ingestAuthFailure } from '@/lib/ingest-auth'
import { attachmentKey, createUploadUrl, isS3Enabled } from '@/lib/storage'

// Presigned direct-to-S3 upload for the ingestion worker. Large scans (full-arch
// zips can be 150 MB+) must NOT be inlined as base64 in the /api/ingest/cases
// JSON body — that buffers the whole file in the portal and OOMs it. The worker
// requests a presigned PUT here, uploads the bytes straight to S3, then creates
// the case referencing the returned `key` via `attachment.storageKey`.
export async function POST(request: NextRequest) {
  const denied = ingestAuthFailure(request)
  if (denied) return denied

  if (!isS3Enabled()) {
    return NextResponse.json({ error: 'S3 storage is not configured' }, { status: 503 })
  }

  let body: { name?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'scan.bin'
  const key = attachmentKey(name)
  const url = await createUploadUrl(key)
  return NextResponse.json({ key, url }, { status: 200 })
}

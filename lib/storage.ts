/**
 * Attachment storage. Prefers S3 (via the EC2 instance IAM role — no static
 * credentials needed); falls back to inline base64 for local dev when
 * `S3_BUCKET` is not configured.
 *
 * Required env for S3: S3_BUCKET, AWS_REGION. Optional: S3_KEY_PREFIX.
 */
import { randomUUID } from 'crypto'
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const BUCKET = process.env.S3_BUCKET
const REGION = process.env.AWS_REGION ?? 'us-east-1'
const PREFIX = (process.env.S3_KEY_PREFIX ?? 'case-attachments/').replace(/^\/+/, '')
const PRESIGN_TTL_SECONDS = 15 * 60

export function isS3Enabled(): boolean {
  return !!BUCKET
}

// Lazily created so builds/dev without S3 never touch the SDK.
let _client: S3Client | null = null
function client(): S3Client {
  if (!_client) _client = new S3Client({ region: REGION })
  return _client
}

/** Parse a `data:<mime>;base64,<data>` URL into bytes + mime. */
export function parseDataUrl(dataUrl: string): { bytes: Buffer; mimeType: string } | null {
  const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(dataUrl)
  if (!m) return null
  const mimeType = m[1] || 'application/octet-stream'
  const isBase64 = !!m[2]
  const bytes = isBase64 ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]))
  return { bytes, mimeType }
}

// Case-scoped key prefix, e.g. `case-attachments/cases/41/`. A case's files live
// together (easy per-case lifecycle) and it lets us verify a client-supplied
// (directly-uploaded) key really belongs to the case it's being posted to.
export function caseKeyPrefix(caseId: string | number): string {
  return `${PREFIX}cases/${String(caseId).replace(/[^\w.\-]+/g, '')}/`
}
export function keyBelongsToCase(key: string, caseId: string | number): boolean {
  const p = caseKeyPrefix(caseId)
  return p.length > PREFIX.length + 'cases//'.length && key.startsWith(p)
}

// Build a unique object key for an attachment (case-scoped when caseId given).
export function attachmentKey(originalName: string, opts?: { caseId?: string | number }): string {
  const safe = originalName.replace(/[^\w.\-]+/g, '_').slice(-80)
  const scope =
    opts?.caseId != null && String(opts.caseId).length > 0
      ? caseKeyPrefix(opts.caseId).slice(PREFIX.length) // `cases/<id>/`
      : `${new Date().toISOString().slice(0, 7)}/` // YYYY-MM fallback
  return `${PREFIX}${scope}${randomUUID()}-${safe}`
}

/** Upload bytes to S3 and return the object key. Keys are case-scoped, e.g.
 *  `case-attachments/cases/41/9f3a…-cbct.stl`, so a case's files live together
 *  (easy per-case lifecycle rules / deletion). */
export async function putAttachment(
  bytes: Buffer,
  mimeType: string,
  originalName: string,
  opts?: { caseId?: string | number }
): Promise<string> {
  const key = attachmentKey(originalName, opts)
  await client().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: bytes,
      ContentType: mimeType,
      ServerSideEncryption: 'AES256',
    })
  )
  return key
}

/** Time-limited presigned GET URL for an S3 object key. */
export async function getAttachmentUrl(key: string): Promise<string> {
  return getSignedUrl(
    client(),
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn: PRESIGN_TTL_SECONDS }
  )
}

export async function deleteAttachment(key: string): Promise<void> {
  await client().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
}

// Presigned PUT URL for a DIRECT browser upload (bypasses the JSON body / base64
// cap). At-rest encryption comes from the bucket's DEFAULT SSE (set in the
// deploy runbook); the browser sets the object's Content-Type at PUT time so an
// exocad `.html` is stored as text/html and renders inline on read.
export async function createUploadUrl(key: string): Promise<string> {
  return getSignedUrl(client(), new PutObjectCommand({ Bucket: BUCKET, Key: key }), {
    expiresIn: PRESIGN_TTL_SECONDS,
  })
}

// Confirm a (directly-uploaded) object exists and return its true byte size, so
// the server can trust the size independent of what the client declared.
export async function headAttachment(key: string): Promise<{ size: number } | null> {
  try {
    const r = await client().send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))
    return { size: r.ContentLength ?? 0 }
  } catch {
    return null
  }
}

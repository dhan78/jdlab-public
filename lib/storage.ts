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
  CopyObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
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

/** Server-side copy an existing S3 object (e.g. an already-uploaded scans/raw/
 *  scan) into the attachment key space, so ingestion never round-trips a large
 *  file through the worker. Returns the new attachment key. CopySource is
 *  `<bucket>/<url-encoded-key>` (segments encoded, slashes preserved). */
export async function copyIntoAttachments(
  sourceBucket: string,
  sourceKey: string,
  originalName: string
): Promise<string> {
  const key = attachmentKey(originalName)
  const encodedSource = `${sourceBucket}/${sourceKey.split('/').map(encodeURIComponent).join('/')}`
  await client().send(
    new CopyObjectCommand({
      Bucket: BUCKET,
      Key: key,
      CopySource: encodedSource,
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

// --- Optimized scan previews (GLB) --------------------------------------------
// The S3 conversion Lambda writes decimated GLBs under SCAN_GLB_PREFIX in
// SCAN_BUCKET (a zip fans out to one GLB per mesh; an STL/PLY yields one). We
// resolve them at VIEW time from a case's source scan key — no callback, no
// stored case↔glb link — so previews appear whenever conversion has finished.
// Off (returns []) unless SCAN_BUCKET is configured, so dev degrades cleanly.

const SCAN_BUCKET = process.env.SCAN_BUCKET
const SCAN_RAW_PREFIX = (process.env.SCAN_RAW_PREFIX ?? 'scans/raw/').replace(/^\/+/, '')
const SCAN_GLB_PREFIX = (process.env.SCAN_GLB_PREFIX ?? 'scans/glb/').replace(/^\/+/, '')

export interface GlbPreview {
  name: string
  url: string
  size: number
}

// The S3 ingestion source sets externalId = "s3:<key>:<etag>"; recover <key>.
function scanRawKeyFromExternalId(externalId?: string | null): string | null {
  if (!externalId || !externalId.startsWith('s3:')) return null
  const rest = externalId.slice(3)
  const at = rest.lastIndexOf(':')
  const key = at > 0 ? rest.slice(0, at) : rest
  return key.startsWith(SCAN_RAW_PREFIX) ? key : null
}

// List + presign the GLB(s) produced for a case's source scan. A prefix match on
// "<glb-prefix><stem>" covers both a zip's per-mesh folder and a single-file GLB.
export async function resolveGlbPreviews(externalId?: string | null): Promise<GlbPreview[]> {
  if (!SCAN_BUCKET) return []
  const rawKey = scanRawKeyFromExternalId(externalId)
  if (!rawKey) return []
  const stem = rawKey.slice(SCAN_RAW_PREFIX.length).replace(/\.[^./]+$/, '')
  try {
    const res = await client().send(
      new ListObjectsV2Command({ Bucket: SCAN_BUCKET, Prefix: `${SCAN_GLB_PREFIX}${stem}` })
    )
    const objs = (res.Contents ?? []).filter(o => o.Key?.toLowerCase().endsWith('.glb'))
    objs.sort((a, b) => (a.Key ?? '').localeCompare(b.Key ?? ''))
    return Promise.all(
      objs.map(async o => ({
        name: o.Key!.split('/').pop()!,
        size: o.Size ?? 0,
        url: await getSignedUrl(client(), new GetObjectCommand({ Bucket: SCAN_BUCKET, Key: o.Key! }), {
          expiresIn: PRESIGN_TTL_SECONDS,
        }),
      }))
    )
  } catch {
    return []
  }
}

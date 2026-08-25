/**
 * Event-driven scan INGEST Lambda — creates a portal case for each raw scan.
 *
 * Wiring (fan-out, no polling):
 *   s3://<bucket>/scans/raw/…  --ObjectCreated-->  EventBridge
 *        ├─► jdlab-scan-convert Lambda   (raw → scans/glb/ GLB preview)
 *        └─► SQS  ──►  THIS Lambda  ──►  POST <portal>/api/ingest/cases
 *
 * The two branches are independent: a case is created even if GLB conversion
 * fails (the preview just lights up later). This function never downloads the
 * scan — it passes a `copyFrom` S3 reference so the portal copies it server-side
 * into the case-attachment space.
 *
 * Idempotency: externalId = `s3:<key>:<etag>` (the portal dedupes on it), so an
 * at-least-once SQS redelivery never double-creates a case.
 *
 * Env:
 *   PORTAL_BASE_URL             e.g. https://jdlab.us            [required]
 *   INGEST_API_TOKEN            matches the portal's token       [required]
 *   RAW_PREFIX                  input prefix   (default scans/raw/)
 *   PROCESSED_PREFIX            skip prefix    (default processed/)
 *   UNMAPPED_PREFIX             skip prefix    (default unmapped/)
 *   INGEST_DEFAULT_DOCTOR_EMAIL fallback when metadata carries no doctor
 *   INGEST_HTTP_TIMEOUT_MS      portal POST timeout (default 300000)
 *
 * `@aws-sdk/client-s3` and global `fetch` are provided by the Node 22 runtime,
 * so this function has NO bundled dependencies — deploy `ingest-case.mjs` alone.
 */
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3'

const REGION = process.env.AWS_REGION || 'us-east-1'
const PORTAL_BASE_URL = (process.env.PORTAL_BASE_URL || '').replace(/\/+$/, '')
const INGEST_TOKEN = process.env.INGEST_API_TOKEN || ''
const RAW_PREFIX = (process.env.RAW_PREFIX || 'scans/raw/').replace(/^\/+/, '')
const PROCESSED_PREFIX = (process.env.PROCESSED_PREFIX || 'processed/').replace(/^\/+/, '')
const UNMAPPED_PREFIX = (process.env.UNMAPPED_PREFIX || 'unmapped/').replace(/^\/+/, '')
const DEFAULT_DOCTOR_EMAIL = (process.env.INGEST_DEFAULT_DOCTOR_EMAIL || '').trim().toLowerCase()
const TIMEOUT_MS = Number(process.env.INGEST_HTTP_TIMEOUT_MS || 300000)

const s3 = new S3Client({ region: REGION })

// Injectable I/O so tests can pass fakes as a 3rd arg without module mocking —
// env-independent (can't regress to hitting real S3). Prod uses these defaults.
const DEFAULT_DEPS = { s3, fetch }

const MODEL_EXTS = ['.stl', '.ply', '.obj', '.zip']
const isModelFile = name => MODEL_EXTS.some(ext => name.toLowerCase().endsWith(ext))

function guessMime(name) {
  const l = name.toLowerCase()
  if (l.endsWith('.stl')) return 'model/stl'
  if (l.endsWith('.zip')) return 'application/zip'
  if (l.endsWith('.obj')) return 'text/plain'
  return 'application/octet-stream'
}

const basename = key => (key.includes('/') ? key.slice(key.lastIndexOf('/') + 1) : key)
const stripExt = name => name.replace(/\.[^./]+$/, '')

// Pull {bucket,key,etag,size} out of one message. Handles the SQS→EventBridge
// "Object Created" shape (detail.*) and a bare EventBridge/S3 event for manual
// `aws lambda invoke` testing.
function extractObject(payload) {
  const evt = typeof payload === 'string' ? JSON.parse(payload) : payload
  if (evt?.detail?.bucket) {
    const d = evt.detail
    return {
      bucket: d.bucket.name,
      key: d.object?.key,
      etag: String(d.object?.etag || '').replace(/"/g, ''),
      size: Number(d.object?.size || 0),
    }
  }
  // Classic S3 notification record (keys are URL-encoded here).
  const rec = evt?.Records?.[0]?.s3
  if (rec) {
    return {
      bucket: rec.bucket?.name,
      key: decodeURIComponent(String(rec.object?.key || '').replace(/\+/g, ' ')),
      etag: String(rec.object?.eTag || '').replace(/"/g, ''),
      size: Number(rec.object?.size || 0),
    }
  }
  return { bucket: undefined, key: undefined, etag: '', size: 0 }
}

export async function handler(event, _context, deps = DEFAULT_DEPS) {
  // SQS batch (the production path); fall back to a single direct event.
  const records = Array.isArray(event?.Records) && event.Records[0]?.body
    ? event.Records
    : [{ messageId: 'direct', body: JSON.stringify(event) }]

  const batchItemFailures = []
  for (const record of records) {
    try {
      await processMessage(record.body, deps)
    } catch (err) {
      // Return the message to the queue (partial-batch retry); exhausted
      // retries land in the DLQ for human review + replay.
      console.error(`ingest failed (will retry): ${err?.message || err}`)
      batchItemFailures.push({ itemIdentifier: record.messageId })
    }
  }
  return { batchItemFailures }
}

async function processMessage(body, deps = DEFAULT_DEPS) {
  const { s3, fetch } = deps
  const { bucket, key, etag, size } = extractObject(body)
  if (!bucket || !key) {
    console.log('no bucket/key in event — skipping')
    return
  }
  if (key.endsWith('/') || !isModelFile(key)) {
    console.log(`skip (not a model file): ${key}`)
    return
  }
  if (key.startsWith(PROCESSED_PREFIX) || key.startsWith(UNMAPPED_PREFIX)) {
    console.log(`skip (processed/unmapped): ${key}`)
    return
  }

  // Object metadata (x-amz-meta-*) isn't in the event — HEAD for the mapping.
  const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
  const meta = {}
  for (const [k, v] of Object.entries(head.Metadata || {})) meta[k.toLowerCase()] = v
  const effEtag = etag || String(head.ETag || '').replace(/"/g, '')
  const effSize = size || Number(head.ContentLength || 0)

  const doctor = String(meta['doctor-email'] || DEFAULT_DOCTOR_EMAIL).trim().toLowerCase()
  // Route by the first path segment under the intake prefix:
  //   scans/raw/lindqvist/scan.stl  ->  practice key 'lindqvist'.
  const rel = key.startsWith(RAW_PREFIX) ? key.slice(RAW_PREFIX.length) : key
  const practiceKey = rel.includes('/') ? rel.split('/')[0] : ''
  if (!doctor && !practiceKey) {
    console.warn(`skip s3://${bucket}/${key}: no doctor-email and no practice prefix`)
    return
  }

  const name = basename(key)
  const payload = {
    externalId: `s3:${key}:${effEtag}`,
    doctorEmail: doctor || null,
    practiceKey: practiceKey || null,
    title: String(meta['title'] || stripExt(name)),
    caseType: meta['case-type'] || 'guide',
    patientName: meta['patient-name'] || null,
    toothRef: meta['tooth-ref'] || null,
    material: meta['material'] || null,
    scannerBrand: meta['scanner-brand'] || null,
    isRush: false,
    specialInstructions: null,
    // The scan already lives in S3 — never download it; the portal copies it
    // server-side into the case-attachment space via copyFrom.
    attachment: {
      name,
      mimeType: guessMime(name),
      size: effSize,
      copyFrom: { sourceBucket: bucket, sourceKey: key },
    },
  }

  const res = await fetch(`${PORTAL_BASE_URL}/api/ingest/cases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${INGEST_TOKEN}` },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })

  // 409 unmapped practice / 422 mapped email has no portal account: a permanent
  // condition until a human fixes the practice map. Throw so SQS retries a few
  // times then DLQs it (the review queue) — never silently dropped, since with
  // no poller the event won't fire again.
  if (res.status === 409 || res.status === 422) {
    const text = await res.text()
    throw new Error(`unmapped/rejected ${res.status}: ${text.slice(0, 200)}`)
  }
  if (res.status !== 200 && res.status !== 201) {
    const text = await res.text()
    throw new Error(`ingest API ${res.status}: ${text.slice(0, 300)}`)
  }
  const out = await res.json().catch(() => ({}))
  console.log(`case ${out.created ? 'created' : 'exists'}: ${out.caseId || '?'} (${key})`)
}

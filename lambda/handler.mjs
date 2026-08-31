/**
 * S3-triggered Lambda: convert a raw intraoral scan (STL / PLY / OBJ-zip) into a
 * small, decimated, Meshopt-compressed GLB for fast in-browser viewing.
 *
 * Wiring: an S3 ObjectCreated event under RAW_PREFIX reaches this function via
 * SQS (EventBridge rule → jdlab-scan-convert queue → this Lambda), mirroring the
 * ingest path — so a failed/poison conversion redrives a few times then lands in
 * the DLQ instead of being silently dropped by async-invoke retry. It downloads
 * the object, runs the SAME pure-Node `convertScan()` used locally (vendored
 * next to this file at package time — see package.json `vendor`), and writes
 * `<GLB_PREFIX><name>.glb` back to S3. OBJ scans arrive as a .zip (geometry +
 * .mtl + texture); we unzip in-memory and feed the companion files to the
 * converter via `resolveAsset`. Output is a deterministic key, so SQS
 * at-least-once redelivery just overwrites — safe to retry.
 *
 * Recursion guard: we only process keys under RAW_PREFIX and always write under
 * GLB_PREFIX, so the output never re-triggers the function. The EventBridge rule
 * ALSO restricts by prefix (see aws/ingest-eventbridge-pattern.json).
 *
 * Env:
 *   GLB_BUCKET   destination bucket (default: the source bucket)
 *   RAW_PREFIX   input key prefix   (default: "scans/raw/")
 *   GLB_PREFIX   output key prefix  (default: "scans/glb/")
 *   TARGET_TRIS  triangle budget    (default: converter's 350000)
 *
 * @aws-sdk/client-s3 is provided by the Lambda Node runtime — NOT bundled.
 */
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { unzipSync } from 'fflate'
import { basename, extname } from 'node:path'
import { convertScan } from './convert-scan.mjs'

const s3 = new S3Client({})

const RAW_PREFIX = process.env.RAW_PREFIX ?? 'scans/raw/'
const GLB_PREFIX = process.env.GLB_PREFIX ?? 'scans/glb/'
const TARGET_TRIS = process.env.TARGET_TRIS ? parseInt(process.env.TARGET_TRIS, 10) : undefined

const MODEL_EXTS = new Set(['stl', 'ply', 'obj', 'zip'])

// S3 event keys are URL-encoded and use '+' for spaces.
function decodeKey(key) {
  return decodeURIComponent(key.replace(/\+/g, ' '))
}

function extOf(name) {
  return extname(name).slice(1).toLowerCase()
}

// Map a raw key to its output GLB key: swap RAW_PREFIX→GLB_PREFIX, force .glb.
function outputKey(rawKey) {
  const rest = rawKey.startsWith(RAW_PREFIX) ? rawKey.slice(RAW_PREFIX.length) : basename(rawKey)
  return GLB_PREFIX + rest.replace(/\.[^./]+$/, '') + '.glb'
}

async function getObjectBytes(bucket, key) {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  const bytes = await res.Body.transformToByteArray()
  return Buffer.from(bytes)
}

// For an OBJ scan zipped with its .mtl + texture, return { objBuffer, objName,
// resolveAsset } so the converter can pull companion files by name.
// A scan zip (exocad / lab case export) usually holds several meshes — upper &
// lower arches plus the occlusion bite — each often in BOTH .ply and .stl. We
// emit one GLB per mesh, preferring the .ply of a duplicate pair (PLY carries
// the scanner's vertex color; STL is geometry-only). OBJ is supported too, with
// its .mtl/texture companions resolved from the same zip.
const ZIP_MESH_PRIORITY = { ply: 3, obj: 2, stl: 1 }

function zipMeshes(zipBuffer) {
  const entries = unzipSync(new Uint8Array(zipBuffer), { filter: f => !f.name.endsWith('/') })
  // Case-insensitive basename map so an OBJ can resolve its .mtl/texture siblings.
  const byBase = new Map()
  for (const path of Object.keys(entries)) byBase.set(basename(path).toLowerCase(), entries[path])
  const resolveAsset = async name => byBase.get(basename(name).toLowerCase()) ?? null

  // Keep the highest-priority format per mesh stem, so a PLY+STL pair of the
  // same scan converts once (PLY wins).
  const best = new Map()
  for (const path of Object.keys(entries)) {
    const base = basename(path)
    const ext = extOf(base)
    if (!ZIP_MESH_PRIORITY[ext]) continue // skip non-mesh files (and any nested .zip)
    const stem = base.slice(0, base.length - ext.length - 1).toLowerCase()
    const cur = best.get(stem)
    if (!cur || ZIP_MESH_PRIORITY[ext] > cur.prio) best.set(stem, { path, ext, prio: ZIP_MESH_PRIORITY[ext], filename: base })
  }
  if (best.size === 0) throw new Error('zip contains no STL/PLY/OBJ mesh')
  // Copy the winning buffers out so the (large) full-zip `entries` can be GC'd.
  return [...best.values()].map(m => ({
    filename: m.filename,
    buffer: Buffer.from(entries[m.path]),
    resolveAsset: m.ext === 'obj' ? resolveAsset : undefined,
  }))
}

// Output key for a mesh extracted from a zip: GLB_PREFIX + <zip path minus .zip>
// / <mesh name>.glb — so one case zip becomes a folder of per-mesh GLBs.
function zipOutputKey(rawKey, filename) {
  const rest = rawKey.startsWith(RAW_PREFIX) ? rawKey.slice(RAW_PREFIX.length) : basename(rawKey)
  const dir = rest.replace(/\.[^./]+$/, '')
  const stem = filename.replace(/\.[^.]+$/, '')
  return `${GLB_PREFIX}${dir}/${stem}.glb`
}

async function processOne(bucket, rawKey) {
  // Skip anything that isn't a raw scan we own (defensive; the S3 filter should
  // already scope this) so we never loop on our own GLB output.
  if (!rawKey.startsWith(RAW_PREFIX) || rawKey.startsWith(GLB_PREFIX)) {
    console.log(`skip (outside RAW_PREFIX): ${rawKey}`)
    return
  }
  const ext = extOf(rawKey)
  if (!MODEL_EXTS.has(ext)) {
    console.log(`skip (unsupported ext .${ext}): ${rawKey}`)
    return
  }

  const raw = await getObjectBytes(bucket, rawKey)
  const outBucket = process.env.GLB_BUCKET || bucket

  // One job per output GLB: a zip fans out to one mesh each (upper/lower/
  // occlusion); every other format is a single mesh.
  const jobs =
    ext === 'zip'
      ? zipMeshes(raw).map(m => ({ ...m, outKey: zipOutputKey(rawKey, m.filename) }))
      : [{ filename: basename(rawKey), buffer: raw, resolveAsset: undefined, outKey: outputKey(rawKey) }]

  const failures = []
  for (const job of jobs) {
    try {
      const { glb, stats } = await convertScan(job.buffer, {
        filename: job.filename,
        resolveAsset: job.resolveAsset,
        ...(TARGET_TRIS ? { targetTris: TARGET_TRIS } : {}),
      })
      await s3.send(
        new PutObjectCommand({
          Bucket: outBucket,
          Key: job.outKey,
          Body: glb,
          ContentType: 'model/gltf-binary',
          // Small, non-PHI stats for observability (S3 metadata values are strings).
          Metadata: {
            'source-key': rawKey.slice(0, 1024),
            format: String(stats.format),
            'input-tris': String(stats.inputTris),
            'output-tris': String(stats.outputTris),
            'output-bytes': String(stats.outputBytes),
            shrink: String(stats.shrink),
            'ms-total': String(stats.msTotal),
          },
        }),
      )
      console.log(
        `converted ${rawKey} → ${outBucket}/${job.outKey} ` +
          `(${stats.format}, ${stats.inputTris}→${stats.outputTris} tris, ` +
          `${(stats.outputBytes / 1024).toFixed(0)}KB, ${stats.shrink}× smaller, ${stats.msTotal}ms)`,
      )
    } catch (err) {
      // Convert as many meshes as possible; report which ones failed at the end.
      console.error(`FAILED ${rawKey}#${job.filename}: ${err instanceof Error ? err.stack : err}`)
      failures.push(`${job.filename}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  if (failures.length) {
    throw new Error(`${failures.length}/${jobs.length} mesh(es) failed for ${rawKey}: ${failures.join('; ')}`)
  }
}

// Normalize a single (non-SQS) trigger into {bucket, rawKey} records. Supports
// the EventBridge "Object Created" shape (detail.*, key NOT url-encoded) AND the
// classic S3 notification shape (Records[].s3, key url-encoded) — so the parse
// works for an EventBridge target, a direct S3 trigger, and manual invokes with
// either payload. (The SQS envelope is peeled off in `handler` before this.)
function eventRecords(event) {
  if (event?.detail?.bucket) {
    return [{ bucket: event.detail.bucket.name, rawKey: event.detail.object?.key ?? '' }]
  }
  return (event?.Records ?? []).map(r => ({
    bucket: r.s3?.bucket?.name,
    rawKey: decodeKey(r.s3?.object?.key ?? ''),
  }))
}

// Convert every object referenced by one event. Aggregates per-object results
// and throws if any failed, so a direct/manual invoke surfaces a non-2xx result.
async function processEvent(event) {
  const results = []
  for (const { bucket, rawKey } of eventRecords(event)) {
    if (!bucket || !rawKey) continue
    try {
      await processOne(bucket, rawKey)
      results.push({ key: rawKey, ok: true })
    } catch (err) {
      // Log and continue so one bad object doesn't fail a multi-record batch.
      console.error(`FAILED ${rawKey}: ${err instanceof Error ? err.stack : err}`)
      results.push({ key: rawKey, ok: false, error: err instanceof Error ? err.message : String(err) })
    }
  }
  const failed = results.filter(r => !r.ok)
  if (failed.length) {
    // Surface partial failures so retries/alerts can key off a non-2xx result.
    throw new Error(`${failed.length}/${results.length} conversion(s) failed: ${failed.map(f => f.key).join(', ')}`)
  }
  return { ok: true, converted: results.length }
}

export async function handler(event) {
  // SQS batch (the production path): each record.body is the EventBridge
  // "Object Created" event as a JSON string. Report per-message failures so only
  // the failed scan redrives → DLQ (needs ReportBatchItemFailures on the mapping;
  // batch size is 1, but the loop handles any size).
  if (Array.isArray(event?.Records) && event.Records[0]?.body !== undefined) {
    const batchItemFailures = []
    for (const record of event.Records) {
      try {
        await processEvent(JSON.parse(record.body))
      } catch (err) {
        // Return the message to the queue; exhausted retries land in the DLQ.
        console.error(`convert failed (will retry): ${err instanceof Error ? err.stack : err}`)
        batchItemFailures.push({ itemIdentifier: record.messageId })
      }
    }
    return { batchItemFailures }
  }
  // Direct EventBridge target / classic S3 trigger / manual invoke.
  return processEvent(event)
}

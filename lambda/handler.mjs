/**
 * S3-triggered Lambda: convert a raw intraoral scan (STL / PLY / OBJ-zip) into a
 * small, decimated, Meshopt-compressed GLB for fast in-browser viewing.
 *
 * Wiring: an S3 ObjectCreated event under RAW_PREFIX invokes this function. It
 * downloads the object, runs the SAME pure-Node `convertScan()` used locally
 * (vendored next to this file at package time — see package.json `vendor`), and
 * writes `<GLB_PREFIX><name>.glb` back to S3. OBJ scans arrive as a .zip
 * (geometry + .mtl + texture); we unzip in-memory and feed the companion files
 * to the converter via `resolveAsset`.
 *
 * Recursion guard: we only process keys under RAW_PREFIX and always write under
 * GLB_PREFIX, so the output never re-triggers the function. The S3 notification
 * filter should ALSO restrict by prefix/suffix (see aws/s3-notify.json).
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
function openObjZip(zipBuffer) {
  const entries = unzipSync(new Uint8Array(zipBuffer)) // { path: Uint8Array }
  // Case-insensitive lookup by basename (zips often nest under a folder).
  const byBase = new Map()
  let objName = null
  for (const path of Object.keys(entries)) {
    if (path.endsWith('/')) continue
    const base = basename(path).toLowerCase()
    byBase.set(base, entries[path])
    if (base.endsWith('.obj')) objName = basename(path)
  }
  if (!objName) throw new Error('zip contains no .obj file')
  const resolveAsset = async name => byBase.get(basename(name).toLowerCase()) ?? null
  return { objBuffer: Buffer.from(byBase.get(objName.toLowerCase())), objName, resolveAsset }
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

  let inputBuffer = raw
  let filename = basename(rawKey)
  let resolveAsset

  if (ext === 'zip') {
    const opened = openObjZip(raw)
    inputBuffer = opened.objBuffer
    filename = opened.objName
    resolveAsset = opened.resolveAsset
  }

  const { glb, stats } = await convertScan(inputBuffer, {
    filename,
    resolveAsset,
    ...(TARGET_TRIS ? { targetTris: TARGET_TRIS } : {}),
  })

  const outBucket = process.env.GLB_BUCKET || bucket
  const outKey = outputKey(rawKey)
  await s3.send(
    new PutObjectCommand({
      Bucket: outBucket,
      Key: outKey,
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
    `converted ${rawKey} → ${outBucket}/${outKey} ` +
      `(${stats.format}, ${stats.inputTris}→${stats.outputTris} tris, ` +
      `${(stats.outputBytes / 1024).toFixed(0)}KB, ${stats.shrink}× smaller, ${stats.msTotal}ms)`,
  )
}

export async function handler(event) {
  const records = event?.Records ?? []
  const results = []
  for (const r of records) {
    const bucket = r.s3?.bucket?.name
    const rawKey = decodeKey(r.s3?.object?.key ?? '')
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

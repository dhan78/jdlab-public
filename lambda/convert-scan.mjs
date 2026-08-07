/**
 * Scan converter — turns a large raw STL/PLY intraoral scan into a small,
 * decimated, Meshopt-compressed GLB for fast web viewing + annotation.
 *
 * PURE NODE (no native binaries) so the SAME code runs locally, in a worker, or
 * in AWS Lambda. Pipeline: three STL/PLY loader → gltf-transform (weld +
 * meshopt simplify) → EXT_meshopt_compression GLB.
 *
 * Local usage (also used to MEASURE time/memory before sizing the Lambda):
 *   node scripts/convert-scan.mjs <input.stl|ply> [output.glb] [targetTris]
 *   e.g. node scripts/convert-scan.mjs I:\scans\upper.stl out.glb 200000
 *
 * The core `convertScan(inputBuffer, { targetTris })` fn returns the GLB bytes
 * and stats; the Lambda handler will call it with the S3 object body.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import { pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { BufferAttribute } from 'three'
import { Document, NodeIO } from '@gltf-transform/core'
import { EXTMeshoptCompression } from '@gltf-transform/extensions'
import { weld } from '@gltf-transform/functions'
import { MeshoptSimplifier, MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer'

// Decimation is COUNT-driven: every scan is reduced to a triangle BUDGET so the
// output size is predictable regardless of how detailed the scan is (a fixed
// error tolerance gave wildly different sizes — 3 MB to 27 MB). `error` is the
// max relative error meshopt may introduce while reaching the budget.
const DEFAULT_TARGET_TRIS = 350_000
const DEFAULT_ERROR = 0.02

function toArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
}

// Pick the loader from the filename extension, falling back to a header sniff
// (PLY begins with ASCII "ply"; OBJ is text with v/f lines; else assume STL).
function detectFormat(filename, ab) {
  const ext = (filename || '').toLowerCase().split('.').pop()
  if (ext === 'ply' || ext === 'stl' || ext === 'obj') return ext
  const head = new TextDecoder().decode(new Uint8Array(ab, 0, Math.min(64, ab.byteLength))).toLowerCase()
  if (head.startsWith('ply')) return 'ply'
  if (/^\s*(#|v\s|vt\s|vn\s|o\s|g\s|mtllib)/.test(head)) return 'obj'
  return 'stl'
}

// Parse STL / PLY / OBJ into a single three BufferGeometry.
function parseGeometry(buffer, format) {
  const ab = toArrayBuffer(buffer)
  let geo
  if (format === 'ply') {
    geo = new PLYLoader().parse(ab)
  } else if (format === 'obj') {
    const text = new TextDecoder().decode(new Uint8Array(ab))
    const group = new OBJLoader().parse(text)
    const geos = []
    group.traverse(o => {
      if (o.isMesh && o.geometry) geos.push(o.geometry)
    })
    if (geos.length === 0) throw new Error('OBJ contains no mesh geometry')
    geo = geos.length === 1 ? geos[0] : mergeGeometries(geos, false) || geos[0]
  } else {
    geo = new STLLoader().parse(ab)
  }
  if (!geo.getAttribute('normal')) geo.computeVertexNormals()
  return geo
}

// OBJ color lives in a companion texture: OBJ → `mtllib x.mtl` → `map_Kd img`.
// `resolveAsset(name)` fetches those sibling files (from disk locally, or S3 in
// the Lambda). Returns { bytes, mime, name } or null if there's no texture.
async function extractObjTexture(buffer, resolveAsset) {
  if (!resolveAsset) return null
  const text = new TextDecoder().decode(new Uint8Array(toArrayBuffer(buffer)))
  const mtlRef = text.match(/^\s*mtllib\s+(.+?)\s*$/im)
  if (!mtlRef) return null
  const mtlBytes = await resolveAsset(mtlRef[1].trim())
  if (!mtlBytes) return null
  const mtlText = new TextDecoder().decode(new Uint8Array(mtlBytes))
  const mapRef = mtlText.match(/^\s*map_Kd\s+(.+?)\s*$/im)
  if (!mapRef) return null
  // map_Kd may carry options ("-o 0 0 file.png"); the filename is the last token.
  const imgName = mapRef[1].trim().split(/\s+/).pop()
  const imgBytes = await resolveAsset(imgName)
  if (!imgBytes) return null
  const iext = imgName.toLowerCase().split('.').pop()
  const mime = iext === 'jpg' || iext === 'jpeg' ? 'image/jpeg' : iext === 'png' ? 'image/png' : null
  if (!mime) return null
  return { bytes: imgBytes, mime, name: imgName }
}

function triangleCount(geo) {
  if (geo.index) return geo.index.count / 3
  return geo.getAttribute('position').count / 3
}

// Build a single-mesh glTF Document from a three BufferGeometry (+ optional
// base-color texture for OBJ scans).
function geometryToDocument(geo, texture) {
  const doc = new Document()
  const buffer = doc.createBuffer()
  const prim = doc.createPrimitive()

  const pos = geo.getAttribute('position')
  prim.setAttribute(
    'POSITION',
    doc.createAccessor().setType('VEC3').setArray(new Float32Array(pos.array)).setBuffer(buffer)
  )
  const norm = geo.getAttribute('normal')
  if (norm) {
    prim.setAttribute(
      'NORMAL',
      doc.createAccessor().setType('VEC3').setArray(new Float32Array(norm.array)).setBuffer(buffer)
    )
  }
  const color = geo.getAttribute('color')
  const hasColor = !!color
  if (color) {
    prim.setAttribute(
      'COLOR_0',
      doc
        .createAccessor()
        .setType(color.itemSize === 4 ? 'VEC4' : 'VEC3')
        .setArray(new Float32Array(color.array))
        .setBuffer(buffer)
    )
  }
  const uv = geo.getAttribute('uv')
  if (uv && texture) {
    prim.setAttribute(
      'TEXCOORD_0',
      doc.createAccessor().setType('VEC2').setArray(new Float32Array(uv.array)).setBuffer(buffer)
    )
  }
  if (geo.index) {
    prim.setIndices(
      doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(geo.index.array)).setBuffer(buffer)
    )
  }

  // Base color MUST be white when the color comes from a texture or COLOR_0 —
  // glTF multiplies them by baseColorFactor, so a grey base would mute it. Bare
  // geometry (STL / plain OBJ) gets a neutral tooth-grey so it still shades well.
  const mat = doc.createMaterial('scan').setRoughnessFactor(0.6).setMetallicFactor(0.02)
  if (texture) {
    const tex = doc
      .createTexture(texture.name || 'scan-texture')
      .setImage(new Uint8Array(texture.bytes))
      .setMimeType(texture.mime)
    mat.setBaseColorTexture(tex).setBaseColorFactor([1, 1, 1, 1])
  } else {
    mat.setBaseColorFactor(hasColor ? [1, 1, 1, 1] : [0.79, 0.83, 0.88, 1])
  }
  prim.setMaterial(mat)

  const mesh = doc.createMesh().addPrimitive(prim)
  doc.createScene().addChild(doc.createNode().setMesh(mesh))
  return doc
}

/**
 * Convert a raw STL/PLY/OBJ buffer into a Meshopt-compressed GLB.
 * @param {Buffer|Uint8Array} inputBuffer - the raw scan bytes
 * @param {object} opts
 * @param {number} [opts.targetTris] - decimation budget
 * @param {string} [opts.filename] - used to pick the loader by extension
 * @param {(name:string)=>Promise<Buffer|null>} [opts.resolveAsset] - fetch OBJ
 *        companion files (.mtl + texture image) from disk / S3
 * @returns {Promise<{ glb: Uint8Array, stats: object }>}
 */
export async function convertScan(inputBuffer, { targetTris = DEFAULT_TARGET_TRIS, filename, resolveAsset, error = DEFAULT_ERROR } = {}) {
  await MeshoptSimplifier.ready
  await MeshoptEncoder.ready

  const t0 = performance.now()
  const format = detectFormat(filename, toArrayBuffer(inputBuffer))
  const geo = parseGeometry(inputBuffer, format)
  const inTris = triangleCount(geo)
  const hasColor = !!geo.getAttribute('color')
  const texture = format === 'obj' ? await extractObjTexture(inputBuffer, resolveAsset) : null
  const tParse = performance.now()

  // Decimate to a TRIANGLE BUDGET with meshopt (count-driven → predictable size
  // across meshes). Weld first to get an indexed manifold; simplify honors the
  // target index count, stopping early only if `error` would be exceeded.
  let workGeo = mergeVertices(geo)
  const weldedTris = (workGeo.index ? workGeo.index.count : workGeo.getAttribute('position').count) / 3
  if (workGeo.index && weldedTris > targetTris) {
    const indices = new Uint32Array(workGeo.index.array)
    const posAttr = workGeo.getAttribute('position')
    const positions =
      posAttr.array instanceof Float32Array ? posAttr.array : new Float32Array(posAttr.array)
    const [newIndices] = MeshoptSimplifier.simplify(indices, positions, 3, Math.floor(targetTris) * 3, error)
    workGeo.setIndex(new BufferAttribute(newIndices, 1))
    // toNonIndexed drops vertices no longer referenced; weld() re-indexes later.
    workGeo = workGeo.toNonIndexed()
    workGeo.computeVertexNormals()
  }
  const tSimplify = performance.now()

  const doc = geometryToDocument(workGeo, texture)
  // Weld to re-index cleanly (merges the expanded verts, drops unused ones).
  await doc.transform(weld())

  const io = new NodeIO()
    .registerExtensions([EXTMeshoptCompression])
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder })
  // Meshopt-compress on write.
  doc.createExtension(EXTMeshoptCompression).setRequired(true)
  const glb = await io.writeBinary(doc)
  const tWrite = performance.now()

  // Output triangle count (post-simplify).
  let outTris = inTris
  const outPrim = doc.getRoot().listMeshes()[0]?.listPrimitives()[0]
  if (outPrim) {
    const idx = outPrim.getIndices()
    outTris = idx ? idx.getCount() / 3 : (outPrim.getAttribute('POSITION')?.getCount() ?? 0) / 3
  }

  return {
    glb,
    stats: {
      inputBytes: inputBuffer.byteLength,
      outputBytes: glb.byteLength,
      format,
      inputTris: Math.round(inTris),
      outputTris: Math.round(outTris),
      hasColor,
      hasTexture: !!texture,
      targetError: error,
      shrink: +(inputBuffer.byteLength / Math.max(1, glb.byteLength)).toFixed(1),
      msParse: Math.round(tParse - t0),
      msSimplify: Math.round(tSimplify - tParse),
      msWrite: Math.round(tWrite - tSimplify),
      msTotal: Math.round(tWrite - t0),
      rssPeakMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    },
  }
}

// CLI entry point (measurement / local runs).
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [input, output, targetArg, errorArg] = process.argv.slice(2)
  if (!input) {
    console.error('usage: node scripts/convert-scan.mjs <input.stl|ply|obj> [output.glb] [targetTris] [error]')
    process.exit(1)
  }
  const out = output || input.replace(/\.[^.]+$/, '') + '.glb'
  const targetTris = targetArg ? parseInt(targetArg, 10) : DEFAULT_TARGET_TRIS
  const error = errorArg ? parseFloat(errorArg) : DEFAULT_ERROR
  const buf = await readFile(input)
  // Resolve OBJ companion files (.mtl / texture) from the same folder.
  const dir = dirname(input)
  const resolveAsset = async name => {
    try {
      return await readFile(join(dir, name))
    } catch {
      return null
    }
  }
  const { glb, stats } = await convertScan(buf, { targetTris, filename: input, resolveAsset, error })
  await writeFile(out, glb)
  console.log(JSON.stringify({ input, output: out, targetTris, ...stats }, null, 2))
}

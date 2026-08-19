'use client'

/**
 * Lightweight STL scan viewer (Phase 1). Renders a single STL — from a served
 * URL (e.g. a presigned S3 link) or a local File (drag-and-drop / picker) — with
 * orbit / zoom / pan.
 *
 * Perf choices for good desktop + mobile UX:
 *   - `frameloop="demand"`: only renders on interaction, so an idle scan doesn't
 *     keep the GPU hot / drain a phone battery.
 *   - `dpr={[1, 2]}`: caps the device pixel ratio (retina phones default to 3,
 *     which quadruples fill-rate for no visible gain).
 *   - Geometry is centered + normalized once so any scan frames the same way.
 *
 * Import this ONLY via `next/dynamic` with `{ ssr: false }` — it needs WebGL and
 * must not run during server rendering. See app/scans/viewer/page.tsx.
 */
import { useEffect, useId, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Html, Bounds, useBounds, Line } from '@react-three/drei'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { NeutralToneMapping, Vector3 } from 'three'
import type { BufferGeometry, Group } from 'three'
import { scanCacheKey, getScanBytes, putScanBytes } from '@/lib/scan-cache'
import { loadScanView, saveScanView, clearScanView } from '@/lib/scan-view-state'

// A 3D surface pin the doctor or lab drops on the scan. Coordinates are in the
// centered-geometry local space (see the store), so they re-anchor on reload.
export interface ScanAnnotation {
  id: string
  kind?: string // 'pin' | 'measure'
  x: number
  y: number
  z: number
  bx?: number | null
  by?: number | null
  bz?: number | null
  body: string
  authorName: string
  authorRole: string
  createdAt: string
  canDelete?: boolean
}

interface ScanViewerProps {
  /** URL to an STL or PLY served over HTTP. Used only when no `file` is given. */
  url?: string
  /** A local File (drag-and-drop / picker). Takes precedence over `url`. */
  file?: File | null
  className?: string
  /** Called with a short detail when the model fails to load/parse, so the
   *  caller can capture it into telemetry (the viewer only shows a banner). */
  onError?: (detail: string) => void
  /** Called once the model successfully parses/renders (viewing activity).
   *  `source` reports which tier served it: 'parsed' | 'bytes' | 'network' |
   *  'file' — for cache-hit-rate telemetry. */
  onLoad?: (source?: string) => void
  /** Existing pins to render on the model. */
  annotations?: ScanAnnotation[]
  /** Create a pin, or a measurement (kind='measure' with a second point B).
   *  Presence enables the "Add pin" / "Measure" UI. */
  onCreateAnnotation?: (a: {
    x: number; y: number; z: number; body: string
    kind?: string; bx?: number; by?: number; bz?: number
  }) => void | Promise<void>
  /** Delete a pin by id (only offered on pins the caller marked `canDelete`). */
  onDeleteAnnotation?: (id: string) => void | Promise<void>
  /** View-only mode: render the model + existing pins/measurements but hide ALL
   *  authoring controls (used by the public /demo surface). Belt-and-suspenders
   *  on top of simply not passing the create/delete callbacks. */
  readOnly?: boolean
  /** On coarse-pointer (touch) devices, overlay a "tap to interact" scrim so a
   *  vertical swipe scrolls the PAGE instead of orbiting the model. For inline
   *  viewers; leave off for the maximized/fullscreen view. */
  gateTouch?: boolean
  /** Stable per-scan id. When set, the camera pan/zoom/orbit is remembered for
   *  this scan (localStorage) and restored on return — across navigation AND
   *  page reloads — instead of resetting to the framed default. */
  viewKey?: string
}

// Parse an STL or PLY ArrayBuffer into a centered, normalized geometry. The
// format is sniffed from the header (PLY files begin with the ASCII magic
// "ply"), so it's robust to presigned URLs where the extension is buried in
// query params.
function prepare(buffer: ArrayBuffer): BufferGeometry {
  const head = new TextDecoder()
    .decode(new Uint8Array(buffer, 0, Math.min(5, buffer.byteLength)))
    .toLowerCase()
  const geo = head.startsWith('ply') ? new PLYLoader().parse(buffer) : new STLLoader().parse(buffer)
  geo.center() // recenter on the origin so the camera framing is consistent
  if (!geo.getAttribute('normal')) geo.computeVertexNormals()
  geo.computeBoundingSphere()
  return geo
}

// Meshopt's WASM decoder is a process-wide singleton whose heap can grow (and
// detach its backing ArrayBuffer) mid-decode. When a case renders several inline
// model viewers, their GLB decodes race on that shared heap and throw "Offset is
// outside the bounds of the DataView" (the survivor still renders, the losers
// error out). Await the decoder once, then serialize decodes through a queue so
// only one is ever in flight — eliminating the race without hurting correctness.
let meshoptReady: Promise<unknown> | null = null
let glbDecodeQueue: Promise<unknown> = Promise.resolve()

function parseGlb(buffer: ArrayBuffer): Promise<GLTF> {
  const run = async (): Promise<GLTF> => {
    if (!meshoptReady) meshoptReady = MeshoptDecoder.ready
    await meshoptReady
    const loader = new GLTFLoader()
    loader.setMeshoptDecoder(MeshoptDecoder)
    return new Promise<GLTF>((resolve, reject) => {
      loader.parse(buffer, '', resolve, reject)
    })
  }
  const result = glbDecodeQueue.then(run, run)
  // Keep the chain alive but never let a rejection poison later decodes.
  glbDecodeQueue = result.then(
    () => undefined,
    () => undefined,
  )
  return result
}

// In-memory PARSED cache: skip the Meshopt/STL decode on remounts and tab-hops
// within a session. Keyed by the stable S3 object path (query stripped). We keep
// a pristine MASTER and hand each mount a clone, so concurrent viewers (a tiled
// preview + the maximized overlay of the same scan) never share one scene graph.
// Clones share the underlying (read-only) geometry/material, so a clone is cheap
// relative to a full decode. LRU-bounded to cap decoded-mesh memory on mobile.
type ParsedScan =
  | { kind: 'glb'; scene: Group }
  | { kind: 'mesh'; geometry: BufferGeometry }

const MAX_PARSED = 8 // ~ one full case's worth of scans
const parsedCache = new Map<string, ParsedScan>()

function parsedGet(key: string): ParsedScan | undefined {
  const p = parsedCache.get(key)
  if (p) {
    parsedCache.delete(key)
    parsedCache.set(key, p) // bump to most-recently-used
  }
  return p
}

function parsedPut(key: string, p: ParsedScan): void {
  if (parsedCache.has(key)) parsedCache.delete(key)
  parsedCache.set(key, p)
  while (parsedCache.size > MAX_PARSED) {
    const oldest = parsedCache.keys().next().value as string | undefined
    if (oldest === undefined) break
    parsedCache.delete(oldest)
  }
}

// A draft pin position awaiting a note (before it's saved).
type DraftPoint = { x: number; y: number; z: number }

// Renders the model plus its annotation pins inside a single scaled group, so a
// pin's stored (centered-geometry) coordinates line up with the mesh surface
// regardless of the scan's real-world units.
function Scene({
  geometry,
  annotations,
  addMode,
  draft,
  selectedId,
  onPick,
  onSelect,
  onSaveDraft,
  onCancelDraft,
  onDelete,
}: {
  geometry: BufferGeometry
  annotations: ScanAnnotation[]
  addMode: boolean
  draft: DraftPoint | null
  selectedId: string | null
  onPick: (x: number, y: number, z: number) => void
  onSelect: (id: string | null) => void
  onSaveDraft: (body: string) => void
  onCancelDraft: () => void
  onDelete?: (id: string) => void
}) {
  const radius = geometry.boundingSphere?.radius ?? 1
  const scale = radius > 0 ? 1.4 / radius : 1
  const hasColor = !!geometry.getAttribute('color')
  // Screen coords at pointer-down, to tell a tap (place a pin) from a drag (orbit).
  const down = useRef<{ x: number; y: number } | null>(null)

  return (
    <group scale={scale}>
      <mesh
        geometry={geometry}
        onPointerDown={e => {
          if (addMode) down.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY }
        }}
        onPointerUp={e => {
          if (!addMode) return
          const d = down.current
          down.current = null
          if (!d) return
          const dx = e.nativeEvent.clientX - d.x
          const dy = e.nativeEvent.clientY - d.y
          if (dx * dx + dy * dy > 36) return // moved too far — that was an orbit, not a tap
          e.stopPropagation()
          const p = e.eventObject.worldToLocal(e.point.clone())
          onPick(p.x, p.y, p.z)
        }}
      >
        <meshStandardMaterial
          color={hasColor ? '#ffffff' : '#c9d4e0'}
          vertexColors={hasColor}
          roughness={0.5}
          metalness={0.05}
        />
      </mesh>

      {annotations.map((a, i) => (
        <Html key={a.id} position={[a.x, a.y, a.z]} center zIndexRange={[20, 0]}>
          <AnnotationBadge
            index={i + 1}
            annotation={a}
            selected={selectedId === a.id}
            onSelect={onSelect}
            onDelete={onDelete}
          />
        </Html>
      ))}

      {draft && (
        <Html position={[draft.x, draft.y, draft.z]} center zIndexRange={[30, 0]}>
          <DraftEditor onSave={onSaveDraft} onCancel={onCancelDraft} />
        </Html>
      )}
    </group>
  )
}

// Numbered pin badge with a click-to-open note popover.
function AnnotationBadge({
  index,
  annotation,
  selected,
  onSelect,
  onDelete,
}: {
  index: number
  annotation: ScanAnnotation
  selected: boolean
  onSelect: (id: string | null) => void
  onDelete?: (id: string) => void
}) {
  return (
    <div className="relative" onPointerDown={e => e.stopPropagation()}>
      <button
        type="button"
        data-intent="annotation_open"
        onClick={e => {
          e.stopPropagation()
          onSelect(selected ? null : annotation.id)
        }}
        className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-[11px] font-semibold text-slate-900 shadow ring-2 ring-white/80 transition hover:bg-amber-300"
        title={annotation.body}
      >
        {index}
      </button>
      {/* The note is always visible beside the dot; clicking the dot expands it
          to show the author and (for the author/admin) a delete control. */}
      <div className="absolute left-8 top-1/2 z-10 w-max max-w-[220px] -translate-y-1/2 rounded-lg bg-slate-900/90 px-2.5 py-1.5 text-left shadow-lg ring-1 ring-white/10">
        <p className="whitespace-pre-wrap break-words text-xs leading-snug text-slate-100">{annotation.body}</p>
        {selected && (
          <>
            <p className="mt-1 text-[10px] text-slate-400">{annotation.authorName}</p>
            {annotation.canDelete && onDelete && (
              <button
                type="button"
                data-intent="annotation_delete"
                onClick={e => {
                  e.stopPropagation()
                  onDelete(annotation.id)
                }}
                className="mt-1 text-[11px] text-red-300 hover:text-red-200"
              >
                Delete pin
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// Inline note editor shown at a freshly-placed draft pin.
function DraftEditor({ onSave, onCancel }: { onSave: (body: string) => void; onCancel: () => void }) {
  const [text, setText] = useState('')
  return (
    <div
      onPointerDown={e => e.stopPropagation()}
      className="w-60 -translate-x-1/2 rounded-lg bg-slate-900/95 p-3 shadow-xl ring-1 ring-white/10"
    >
      <textarea
        autoFocus
        rows={3}
        value={text}
        maxLength={500}
        onChange={e => setText(e.target.value)}
        placeholder="Add a note (e.g. open this contact)…"
        className="w-full resize-none rounded bg-slate-800 p-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
      />
      <div className="mt-2 flex justify-end gap-2">
        <button type="button" data-intent="annotation_cancel" onClick={onCancel} className="text-xs text-slate-400 hover:text-slate-200">
          Cancel
        </button>
        <button
          type="button"
          data-intent="annotation_save"
          disabled={!text.trim()}
          onClick={() => onSave(text.trim())}
          className="rounded bg-primary px-2.5 py-1 text-xs font-medium text-white transition hover:bg-primary/90 disabled:opacity-50"
        >
          Save pin
        </button>
      </div>
    </div>
  )
}

// Requests a render frame when annotation state changes, so pins/editors appear
// immediately under `frameloop="demand"` (which otherwise only draws on interaction).
function FrameOnChange({ signal }: { signal: unknown }) {
  const invalidate = useThree(s => s.invalidate)
  useEffect(() => {
    invalidate()
  }, [invalidate, signal])
  return null
}

// Minimal shape of the (OrbitControls) default controls we read/write.
type ControlsLike = {
  target: Vector3
  update?: () => void
  addEventListener?: (type: string, fn: () => void) => void
  removeEventListener?: (type: string, fn: () => void) => void
}

// GLB branch: on mount (per scene) RESTORE the saved camera view for this scan
// if one exists, otherwise FRAME the model once. `resetNonce` bumps to force a
// re-frame from the "Reset view" button. Never re-fits on ordinary re-renders,
// so toggling measure / placing a pin doesn't disturb the user's orbit/pan/zoom.
function RestoreOrFit({
  scene,
  viewKey,
  resetNonce,
}: {
  scene: Group
  viewKey?: string
  resetNonce: number
}) {
  const bounds = useBounds()
  const camera = useThree(s => s.camera)
  const controls = useThree(s => s.controls) as ControlsLike | null
  const invalidate = useThree(s => s.invalidate)
  useEffect(() => {
    const saved = viewKey ? loadScanView(viewKey) : null
    if (saved) {
      if (!controls?.target) return // wait for controls, then restore (no fit flicker)
      camera.position.set(saved.pos[0], saved.pos[1], saved.pos[2])
      controls.target.set(saved.target[0], saved.target[1], saved.target[2])
      controls.update?.()
      invalidate()
    } else {
      bounds.refresh().clip().fit()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, viewKey, resetNonce, controls])
  return null
}

// STL/PLY branch: the model is scaled to the fixed camera, so there's no Bounds
// fit — instead restore the saved view if present, else reset to the default
// framing (also used by "Reset view").
function RestoreView({
  signal,
  viewKey,
  resetNonce,
}: {
  signal: unknown
  viewKey?: string
  resetNonce: number
}) {
  const camera = useThree(s => s.camera)
  const controls = useThree(s => s.controls) as ControlsLike | null
  const invalidate = useThree(s => s.invalidate)
  useEffect(() => {
    if (!controls?.target) return
    const saved = viewKey ? loadScanView(viewKey) : null
    if (saved) {
      camera.position.set(saved.pos[0], saved.pos[1], saved.pos[2])
      controls.target.set(saved.target[0], saved.target[1], saved.target[2])
    } else {
      camera.position.set(0, 0, 3)
      controls.target.set(0, 0, 0)
    }
    controls.update?.()
    invalidate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signal, viewKey, resetNonce, controls])
  return null
}

// Persist the camera view whenever the user finishes an orbit/pan/zoom, keyed by
// the scan's stable id — so it survives navigation AND reloads (localStorage).
function ViewSaver({ viewKey, enabled }: { viewKey?: string; enabled: boolean }) {
  const camera = useThree(s => s.camera)
  const controls = useThree(s => s.controls) as ControlsLike | null
  useEffect(() => {
    if (!viewKey || !enabled || !controls?.addEventListener || !controls.target) return
    const onEnd = () => {
      saveScanView(viewKey, {
        pos: [camera.position.x, camera.position.y, camera.position.z],
        target: [controls.target.x, controls.target.y, controls.target.z],
      })
    }
    controls.addEventListener('end', onEnd)
    return () => controls.removeEventListener?.('end', onEnd)
  }, [viewKey, enabled, controls, camera])
  return null
}

// GLB scene: renders the loaded gltf.scene (materials/colors preserved) framed
// by drei <Bounds> WITHOUT rescaling — GLB geometry is in real millimetres, so
// picked world points are usable measurements directly. Shares the STL/PLY pin
// UX plus a local-only measure tool.
function GlbScene({
  scene,
  annotations,
  addMode,
  measureMode,
  pendingPoint,
  pendingMeasure,
  draft,
  selectedId,
  onPick,
  onMeasurePick,
  onSelect,
  onSaveDraft,
  onCancelDraft,
  onSaveMeasure,
  onCancelMeasure,
  onDelete,
  viewKey,
  resetNonce,
}: {
  scene: Group
  annotations: ScanAnnotation[]
  addMode: boolean
  measureMode: boolean
  pendingPoint: Vector3 | null
  pendingMeasure: { a: Vector3; b: Vector3 } | null
  draft: DraftPoint | null
  selectedId: string | null
  onPick: (x: number, y: number, z: number) => void
  onMeasurePick: (x: number, y: number, z: number) => void
  onSelect: (id: string | null) => void
  onSaveDraft: (body: string) => void
  onCancelDraft: () => void
  onSaveMeasure: (body: string) => void
  onCancelMeasure: () => void
  onDelete?: (id: string) => void
  viewKey?: string
  resetNonce: number
}) {
  const interactive = addMode || measureMode
  // Screen coords at pointer-down, to tell a tap (place a point) from a drag (orbit).
  const down = useRef<{ x: number; y: number } | null>(null)
  const pins = annotations.filter(a => a.kind !== 'measure')
  const measures = annotations.filter(a => a.kind === 'measure' && a.bx != null && a.by != null && a.bz != null)

  return (
    <>
      {/* Restore this scan's saved view if present, else frame ONCE per scene
          (never on every render, so toggling measure / placing a pin doesn't
          reset the user's orbit/pan/zoom). Geometry is NOT rescaled, so world
          hit points stay in real millimetres. */}
      <Bounds clip margin={1.2}>
        <RestoreOrFit scene={scene} viewKey={viewKey} resetNonce={resetNonce} />
        <primitive
          object={scene}
          onPointerDown={(e: { nativeEvent: PointerEvent }) => {
            if (interactive) down.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY }
          }}
          onPointerMove={() => {
            // Movement is measured on pointer-up against the down point below.
          }}
          onPointerUp={(e: { nativeEvent: PointerEvent; point: Vector3; stopPropagation: () => void }) => {
            if (!interactive) return
            const d = down.current
            down.current = null
            if (!d) return
            const dx = e.nativeEvent.clientX - d.x
            const dy = e.nativeEvent.clientY - d.y
            if (dx * dx + dy * dy > 144) return // moved too far — that was an orbit, not a tap
            e.stopPropagation()
            // GLB isn't rescaled, so the WORLD hit point is used directly.
            if (measureMode) onMeasurePick(e.point.x, e.point.y, e.point.z)
            else onPick(e.point.x, e.point.y, e.point.z)
          }}
        />
      </Bounds>

      {pins.map((a, i) => (
        <Html key={a.id} position={[a.x, a.y, a.z]} center zIndexRange={[20, 0]}>
          <AnnotationBadge
            index={i + 1}
            annotation={a}
            selected={selectedId === a.id}
            onSelect={onSelect}
            onDelete={onDelete}
          />
        </Html>
      ))}

      {draft && (
        <Html position={[draft.x, draft.y, draft.z]} center zIndexRange={[30, 0]}>
          <DraftEditor onSave={onSaveDraft} onCancel={onCancelDraft} />
        </Html>
      )}

      {/* Persisted, shared measurements (line + distance + optional note), visible
          to both dentist and lab. */}
      {measures.map(a => {
        const A = new Vector3(a.x, a.y, a.z)
        const B = new Vector3(a.bx as number, a.by as number, a.bz as number)
        const m = A.clone().add(B).multiplyScalar(0.5)
        return (
          <group key={a.id}>
            <Line points={[A, B]} color="#38bdf8" lineWidth={2} />
            <Html position={[A.x, A.y, A.z]} center zIndexRange={[26, 0]}>
              <MeasureDot />
            </Html>
            <Html position={[B.x, B.y, B.z]} center zIndexRange={[26, 0]}>
              <MeasureDot />
            </Html>
            <Html position={[m.x, m.y, m.z]} center zIndexRange={[27, 0]}>
              <MeasureBadge
                annotation={a}
                distance={A.distanceTo(B)}
                selected={selectedId === a.id}
                onSelect={onSelect}
                onDelete={onDelete}
              />
            </Html>
          </group>
        )
      })}

      {/* In-progress first point of the current measurement. */}
      {pendingPoint && (
        <Html position={[pendingPoint.x, pendingPoint.y, pendingPoint.z]} center zIndexRange={[26, 0]}>
          <MeasureDot />
        </Html>
      )}
      {/* Two points placed → show the line + a save-with-note editor. */}
      {pendingMeasure && (
        <>
          <Line points={[pendingMeasure.a, pendingMeasure.b]} color="#38bdf8" lineWidth={2} />
          <Html position={[pendingMeasure.a.x, pendingMeasure.a.y, pendingMeasure.a.z]} center zIndexRange={[26, 0]}>
            <MeasureDot />
          </Html>
          <Html position={[pendingMeasure.b.x, pendingMeasure.b.y, pendingMeasure.b.z]} center zIndexRange={[26, 0]}>
            <MeasureDot />
          </Html>
          <Html
            position={[
              (pendingMeasure.a.x + pendingMeasure.b.x) / 2,
              (pendingMeasure.a.y + pendingMeasure.b.y) / 2,
              (pendingMeasure.a.z + pendingMeasure.b.z) / 2,
            ]}
            center
            zIndexRange={[35, 0]}
          >
            <MeasureEditor
              distance={pendingMeasure.a.distanceTo(pendingMeasure.b)}
              onSave={onSaveMeasure}
              onCancel={onCancelMeasure}
            />
          </Html>
        </>
      )}
    </>
  )
}

function MeasureDot() {
  return <span className="pointer-events-none block h-2.5 w-2.5 rounded-full bg-sky-400 shadow ring-2 ring-white" />
}

// A saved measurement: clickable distance chip → note/author/delete popover.
function MeasureBadge({
  annotation,
  distance,
  selected,
  onSelect,
  onDelete,
}: {
  annotation: ScanAnnotation
  distance: number
  selected: boolean
  onSelect: (id: string | null) => void
  onDelete?: (id: string) => void
}) {
  return (
    <div className="relative" onPointerDown={e => e.stopPropagation()}>
      <button
        type="button"
        data-intent="measure_open"
        onClick={e => {
          e.stopPropagation()
          onSelect(selected ? null : annotation.id)
        }}
        className="select-none rounded bg-sky-500/90 px-1.5 py-0.5 text-[11px] font-semibold text-white shadow ring-1 ring-white/20 transition hover:bg-sky-400"
        title={annotation.body || `${distance.toFixed(1)} mm`}
      >
        {distance.toFixed(1)} mm
      </button>
      {selected && (
        <div className="absolute left-1/2 top-7 z-10 w-52 -translate-x-1/2 rounded-lg bg-slate-900/95 p-3 text-left shadow-xl ring-1 ring-white/10">
          {annotation.body && (
            <p className="whitespace-pre-wrap break-words text-sm text-slate-100">{annotation.body}</p>
          )}
          <p className="mt-1 text-[10px] text-slate-400">
            {annotation.authorName} · {distance.toFixed(1)} mm
          </p>
          {annotation.canDelete && onDelete && (
            <button
              type="button"
              data-intent="measure_delete"
              onClick={e => {
                e.stopPropagation()
                onDelete(annotation.id)
              }}
              className="mt-1 text-[11px] text-red-300 hover:text-red-200"
            >
              Delete measurement
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// Shown after two points are placed: distance + optional note → Save / Cancel.
function MeasureEditor({
  distance,
  onSave,
  onCancel,
}: {
  distance: number
  onSave: (body: string) => void
  onCancel: () => void
}) {
  const [text, setText] = useState('')
  return (
    <div
      onPointerDown={e => e.stopPropagation()}
      className="w-56 -translate-x-1/2 rounded-lg bg-slate-900/95 p-3 shadow-xl ring-1 ring-white/10"
    >
      <p className="text-sm font-semibold text-white">{distance.toFixed(1)} mm</p>
      <textarea
        autoFocus
        rows={2}
        value={text}
        maxLength={500}
        onChange={e => setText(e.target.value)}
        placeholder="Add a note for the dentist (optional)…"
        className="mt-2 w-full resize-none rounded bg-slate-800 p-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
      />
      <div className="mt-2 flex justify-end gap-2">
        <button type="button" data-intent="measure_cancel" onClick={onCancel} className="text-xs text-slate-400 hover:text-slate-200">
          Cancel
        </button>
        <button
          type="button"
          data-intent="measure_save"
          onClick={() => onSave(text.trim())}
          className="rounded bg-sky-500 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-sky-400"
        >
          Save
        </button>
      </div>
    </div>
  )
}

// Neutral tone mapping + slight exposure trim so color intraoral GLBs don't
// read as over-lit (mirrors GlbViewer). Only mounted on the GLB branch.
function GlbTone() {
  const gl = useThree(s => s.gl)
  const invalidate = useThree(s => s.invalidate)
  useEffect(() => {
    /* eslint-disable react-hooks/immutability */
    gl.toneMapping = NeutralToneMapping
    gl.toneMappingExposure = 0.9
    /* eslint-enable react-hooks/immutability */
    invalidate()
  }, [gl, invalidate])
  return null
}

function Overlay({ children, tone }: { children: React.ReactNode; tone?: 'error' }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <span
        className={`rounded-full px-3 py-1 text-sm ${
          tone === 'error' ? 'bg-red-500/15 text-red-200' : 'bg-white/10 text-slate-200'
        }`}
      >
        {children}
      </span>
    </div>
  )
}

// Coordinates the single "live" touch-activated inline viewer across all
// instances on the page: activating one re-arms every other (only one canvas
// ever captures swipes at a time). Module-level so viewers need no shared parent.
let activeViewerId: string | null = null
const viewerListeners = new Set<(id: string | null) => void>()
function setActiveViewer(id: string | null) {
  activeViewerId = id
  viewerListeners.forEach(fn => fn(id))
}

export default function ScanViewer({
  url,
  file,
  className,
  onError,
  onLoad,
  annotations,
  onCreateAnnotation,
  onDeleteAnnotation,
  readOnly = false,
  gateTouch = false,
  viewKey,
}: ScanViewerProps) {
  const [geometry, setGeometry] = useState<BufferGeometry | null>(null)
  const [scene, setScene] = useState<Group | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  // Annotation interaction state.
  const [addMode, setAddMode] = useState(false)
  const [draft, setDraft] = useState<DraftPoint | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Measure tool (GLB branch only; local, not persisted).
  const [measureMode, setMeasureMode] = useState(false)
  // Measure tool (GLB only): first point placed, then a two-point pending
  // measurement awaiting an optional note + Save (persisted, shared with both).
  const [pendingPoint, setPendingPoint] = useState<Vector3 | null>(null)
  const [pendingMeasure, setPendingMeasure] = useState<{ a: Vector3; b: Vector3 } | null>(null)
  // Bumped by "Reset view" to force a re-frame (and clear the saved camera).
  const [resetNonce, setResetNonce] = useState(0)
  // Touch scroll gate: on coarse pointers an inline 3D canvas traps vertical
  // page scrolling, so overlay a "tap to interact" scrim until the user opts in.
  const [coarsePointer, setCoarsePointer] = useState(false)
  const [touchActivated, setTouchActivated] = useState(false)
  const viewerId = useId()
  const rootRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(pointer: coarse)')
    const update = () => setCoarsePointer(mq.matches)
    update()
    mq.addEventListener?.('change', update)
    return () => mq.removeEventListener?.('change', update)
  }, [])
  // Activating this viewer re-arms every other one, so only one captures swipes.
  useEffect(() => {
    const onActiveChange = (id: string | null) => {
      if (id !== viewerId) setTouchActivated(false)
    }
    viewerListeners.add(onActiveChange)
    return () => {
      viewerListeners.delete(onActiveChange)
      if (activeViewerId === viewerId) setActiveViewer(null)
    }
  }, [viewerId])
  // Re-arm the gate when the viewer scrolls out of view, so returning to it
  // needs an explicit tap again and page scroll is never left trapped.
  useEffect(() => {
    if (!gateTouch || !coarsePointer) return
    const el = rootRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          setTouchActivated(false)
          if (activeViewerId === viewerId) setActiveViewer(null)
        }
      },
      { threshold: 0.1 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [gateTouch, coarsePointer, viewerId])
  const touchGateActive = gateTouch && coarsePointer && !touchActivated
  const pins = annotations ?? []
  // Any authoring (pins AND the measure tool, which persists via onCreateAnnotation)
  // requires a create callback and a non-read-only viewer.
  const canAnnotate = !!onCreateAnnotation && !readOnly
  // Keep the latest onError without making it an effect dep (it's an inline
  // callback that changes every render — putting it in deps would refetch).
  const onErrorRef = useRef(onError)
  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])
  const onLoadRef = useRef(onLoad)
  useEffect(() => {
    onLoadRef.current = onLoad
  }, [onLoad])

  useEffect(() => {
    let cancelled = false
    setError(null)
    setGeometry(null)
    setScene(null)
    setMeasureMode(false)
    setPendingPoint(null)
    setPendingMeasure(null)
    if (!file && !url) return

    setLoading(true)
    const run = async () => {
      try {
        // Scans are served via presigned S3 URLs whose signature rotates each
        // load, so the browser HTTP cache never hits. Cache by the STABLE object
        // path (query stripped): parsed-scene cache → byte cache → network.
        //
        // NEVER cache `data:` URLs: they're already local bytes (no download to
        // save) and their "stable path" key would be the entire multi-MB base64
        // blob — which collides/breaks in the byte + Cache-Storage tiers and made
        // every viewer render the FIRST cached scan. Uncacheable → decode fresh.
        const key = url && !file && !url.startsWith('data:') ? scanCacheKey(url) : null

        // Tier 0: already-parsed in this session → clone and show instantly
        // (skips both the network AND the Meshopt/STL decode).
        if (key) {
          const parsed = parsedGet(key)
          if (parsed) {
            if (cancelled) return
            if (parsed.kind === 'glb') setScene(parsed.scene.clone(true) as Group)
            else setGeometry(parsed.geometry.clone())
            setLoading(false)
            onLoadRef.current?.('parsed')
            return
          }
        }

        let buffer: ArrayBuffer
        let byteSource: 'file' | 'bytes' | 'network' = 'network'
        if (file) {
          buffer = await file.arrayBuffer()
          byteSource = 'file'
        } else {
          // Tier 1/2: cached bytes (memory → Cache Storage), else fetch from S3.
          const cachedBytes = key ? await getScanBytes(key) : null
          if (cachedBytes) {
            buffer = cachedBytes
            byteSource = 'bytes'
          } else {
            // Distinguish a blocked/denied S3 GET (CORS/403) from a bad file: a
            // failed fetch throws, a non-2xx gives a clear `fetch <status>`.
            const res = await fetch(url!)
            if (!res.ok) throw new Error(`fetch ${res.status}`)
            buffer = await res.arrayBuffer()
            // Persist for future revisits (best-effort; never blocks render).
            if (key) void putScanBytes(key, buffer)
          }
        }
        if (cancelled) return
        // Sniff the GLB binary magic ("glTF" = 0x67 0x6C 0x54 0x46). GLBs render
        // via GLTFLoader with materials preserved; STL/PLY keep their own path.
        const magic = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength))
        const isGlb =
          magic[0] === 0x67 && magic[1] === 0x6c && magic[2] === 0x54 && magic[3] === 0x46
        if (isGlb) {
          try {
            const gltf = await parseGlb(buffer)
            if (cancelled) return
            // Cache the pristine master; display a clone (see parsedCache note).
            if (key) parsedPut(key, { kind: 'glb', scene: gltf.scene })
            setScene(gltf.scene.clone(true) as Group)
            setLoading(false)
            onLoadRef.current?.(byteSource)
          } catch (err) {
            if (cancelled) return
            setError('Could not load or parse this 3D model.')
            setLoading(false)
            onErrorRef.current?.(err instanceof Error ? err.message : 'glb parse failed')
          }
          return
        }
        const geo = prepare(buffer)
        if (!cancelled) {
          if (key) parsedPut(key, { kind: 'mesh', geometry: geo })
          setGeometry(geo.clone())
          setLoading(false)
          onLoadRef.current?.(byteSource)
        }
      } catch (e) {
        if (!cancelled) {
          setError('Could not load or parse this 3D model.')
          setLoading(false)
          onErrorRef.current?.(e instanceof Error ? e.message : 'load/parse failed')
        }
      }
    }
    void run()

    return () => {
      cancelled = true
    }
  }, [url, file])

  return (
    <div ref={rootRef} className={`relative ${className ?? ''} ${measureMode || addMode ? '[&_canvas]:!cursor-crosshair' : ''}`}>
      <Canvas frameloop="demand" dpr={[1, 2]} camera={{ position: [0, 0, 3], fov: 45 }}>
        <color attach="background" args={['#0e1626']} />
        <ambientLight intensity={0.65} />
        <directionalLight position={[4, 5, 6]} intensity={0.9} />
        <directionalLight position={[-4, -3, -5]} intensity={0.35} />
        {scene && <hemisphereLight args={['#ffffff', '#3a3a3a', 0.6]} />}
        {geometry && (
          <>
          <RestoreView signal={geometry} viewKey={viewKey} resetNonce={resetNonce} />
          <Scene
            geometry={geometry}
            annotations={pins.filter(a => a.kind !== 'measure')}
            addMode={addMode}
            draft={draft}
            selectedId={selectedId}
            onPick={(x, y, z) => setDraft({ x, y, z })}
            onSelect={setSelectedId}
            onSaveDraft={async body => {
              if (!draft) return
              await onCreateAnnotation?.({ ...draft, body })
              setDraft(null)
              setAddMode(false)
            }}
            onCancelDraft={() => {
              setDraft(null)
              setAddMode(false)
            }}
            onDelete={
              onDeleteAnnotation
                ? async id => {
                    await onDeleteAnnotation(id)
                    setSelectedId(null)
                  }
                : undefined
            }
          />
          </>
        )}
        {scene && (
          <>
            <GlbScene
              scene={scene}
              viewKey={viewKey}
              resetNonce={resetNonce}
              annotations={pins}
              addMode={addMode}
              measureMode={measureMode}
              pendingPoint={pendingPoint}
              pendingMeasure={pendingMeasure}
              draft={draft}
              selectedId={selectedId}
              onPick={(x, y, z) => setDraft({ x, y, z })}
              onMeasurePick={(x, y, z) => {
                if (pendingMeasure) return
                const pt = new Vector3(x, y, z)
                if (pendingPoint) {
                  setPendingMeasure({ a: pendingPoint, b: pt })
                  setPendingPoint(null)
                } else {
                  setPendingPoint(pt)
                }
              }}
              onSaveMeasure={body => {
                if (!pendingMeasure) return
                const { a, b } = pendingMeasure
                void onCreateAnnotation?.({ kind: 'measure', x: a.x, y: a.y, z: a.z, bx: b.x, by: b.y, bz: b.z, body })
                setPendingMeasure(null)
              }}
              onCancelMeasure={() => {
                setPendingMeasure(null)
                setPendingPoint(null)
              }}
              onSelect={setSelectedId}
              onSaveDraft={async body => {
                if (!draft) return
                await onCreateAnnotation?.({ ...draft, body })
                setDraft(null)
                setAddMode(false)
              }}
              onCancelDraft={() => {
                setDraft(null)
                setAddMode(false)
              }}
              onDelete={
                onDeleteAnnotation
                  ? async id => {
                      await onDeleteAnnotation(id)
                      setSelectedId(null)
                    }
                  : undefined
              }
            />
            <GlbTone />
          </>
        )}
        <OrbitControls makeDefault enableDamping={false} enablePan enableZoom enableRotate />
        <ViewSaver viewKey={viewKey} enabled={!!(geometry || scene)} />
        <FrameOnChange
          signal={`${pins.length}:${addMode}:${draft ? 1 : 0}:${selectedId ?? ''}:${measureMode}:${pendingMeasure ? 1 : 0}:${pendingPoint ? 1 : 0}`}
        />
      </Canvas>

      {touchGateActive && (
        <button
          type="button"
          data-intent="viewer_touch_activate"
          onClick={() => {
            setTouchActivated(true)
            setActiveViewer(viewerId)
          }}
          style={{ touchAction: 'pan-y' }}
          aria-label="Tap to interact with the 3D model"
          className="absolute inset-0 z-20 flex items-end justify-center pb-3"
        >
          <span className="pointer-events-none rounded-full bg-black/55 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-sm">
            Tap to interact · swipe to scroll
          </span>
        </button>
      )}

      {/* Annotation + measure controls. */}
      {!error && (geometry || scene) && !touchGateActive && (
        <div className="absolute left-2 top-2 z-20 flex flex-wrap items-center gap-2">
          {canAnnotate && (
            <button
              type="button"
              data-intent="annotation_addmode"
              onClick={() => {
                setSelectedId(null)
                setDraft(null)
                setMeasureMode(false)
                setAddMode(m => !m)
              }}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium shadow-sm backdrop-blur-sm transition ${
                addMode
                  ? 'bg-amber-400 text-slate-900 hover:bg-amber-300'
                  : 'bg-black/40 text-white/90 hover:bg-black/60'
              }`}
            >
              {addMode ? 'Click the model to pin' : '+ Add pin'}
            </button>
          )}
          {canAnnotate && addMode && (
            <button
              type="button"
              data-intent="annotation_addmode_cancel"
              onClick={() => {
                setAddMode(false)
                setDraft(null)
              }}
              className="rounded-lg bg-black/40 px-2.5 py-1.5 text-xs text-white/80 backdrop-blur-sm transition hover:bg-black/60"
            >
              Cancel
            </button>
          )}
          {scene && canAnnotate && (
            <button
              type="button"
              data-intent="measure_toggle"
              onClick={() => {
                setAddMode(false)
                setDraft(null)
                setMeasureMode(m => !m)
              }}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium shadow-sm backdrop-blur-sm transition ${
                measureMode
                  ? 'bg-sky-400 text-slate-900 hover:bg-sky-300'
                  : 'bg-black/40 text-white/90 hover:bg-black/60'
              }`}
            >
              {measureMode ? (pendingMeasure ? 'Add note & save' : pendingPoint ? 'Click 2nd point' : 'Click a point') : '↔ Measure'}
            </button>
          )}
          {scene && canAnnotate && (pendingPoint || pendingMeasure) && (
            <button
              type="button"
              data-intent="measure_clear"
              onClick={() => {
                setPendingPoint(null)
                setPendingMeasure(null)
              }}
              className="rounded-lg bg-black/40 px-2.5 py-1.5 text-xs text-white/80 backdrop-blur-sm transition hover:bg-black/60"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Reset view — separate corner so it never crowds the pin/measure tools. */}
      {!error && (geometry || scene) && viewKey && !touchGateActive && (
        <button
          type="button"
          data-intent="view_reset"
          onClick={() => {
            if (viewKey) clearScanView(viewKey)
            setResetNonce(n => n + 1)
          }}
          title="Reset the camera to the default framing"
          className="absolute bottom-2 right-2 z-20 rounded-lg bg-black/40 px-2.5 py-1.5 text-xs text-white/80 backdrop-blur-sm transition hover:bg-black/60"
        >
          Reset view
        </button>
      )}

      {loading && <Overlay>Loading scan…</Overlay>}
      {error && <Overlay tone="error">{error}</Overlay>}
      {!loading && !error && !geometry && !scene && <Overlay>No scan loaded</Overlay>}
    </div>
  )
}

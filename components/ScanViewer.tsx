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
import { useEffect, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js'
import type { BufferGeometry } from 'three'

// A 3D surface pin the doctor or lab drops on the scan. Coordinates are in the
// centered-geometry local space (see the store), so they re-anchor on reload.
export interface ScanAnnotation {
  id: string
  x: number
  y: number
  z: number
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
  /** Existing pins to render on the model. */
  annotations?: ScanAnnotation[]
  /** Create a pin at a picked surface point. Presence enables the "Add pin" UI. */
  onCreateAnnotation?: (a: { x: number; y: number; z: number; body: string }) => void | Promise<void>
  /** Delete a pin by id (only offered on pins the caller marked `canDelete`). */
  onDeleteAnnotation?: (id: string) => void | Promise<void>
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
    <div className="relative">
      <button
        type="button"
        onPointerDown={e => e.stopPropagation()}
        onClick={e => {
          e.stopPropagation()
          onSelect(selected ? null : annotation.id)
        }}
        className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-[11px] font-semibold text-slate-900 shadow ring-2 ring-white/80 transition hover:bg-amber-300"
        title={annotation.body}
      >
        {index}
      </button>
      {selected && (
        <div
          onPointerDown={e => e.stopPropagation()}
          className="absolute left-8 top-1/2 z-10 w-56 -translate-y-1/2 rounded-lg bg-slate-900/95 p-3 text-left shadow-xl ring-1 ring-white/10"
        >
          <p className="whitespace-pre-wrap break-words text-sm text-slate-100">{annotation.body}</p>
          <p className="mt-2 text-[11px] text-slate-400">{annotation.authorName}</p>
          {annotation.canDelete && onDelete && (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation()
                onDelete(annotation.id)
              }}
              className="mt-2 text-xs text-red-300 hover:text-red-200"
            >
              Delete pin
            </button>
          )}
        </div>
      )}
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
        <button type="button" onClick={onCancel} className="text-xs text-slate-400 hover:text-slate-200">
          Cancel
        </button>
        <button
          type="button"
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

export default function ScanViewer({
  url,
  file,
  className,
  onError,
  annotations,
  onCreateAnnotation,
  onDeleteAnnotation,
}: ScanViewerProps) {
  const [geometry, setGeometry] = useState<BufferGeometry | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  // Annotation interaction state.
  const [addMode, setAddMode] = useState(false)
  const [draft, setDraft] = useState<DraftPoint | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const pins = annotations ?? []
  const canAnnotate = !!onCreateAnnotation
  // Keep the latest onError without making it an effect dep (it's an inline
  // callback that changes every render — putting it in deps would refetch).
  const onErrorRef = useRef(onError)
  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  useEffect(() => {
    let cancelled = false
    setError(null)
    setGeometry(null)
    if (!file && !url) return

    setLoading(true)
    const run = async () => {
      try {
        let buffer: ArrayBuffer
        if (file) {
          buffer = await file.arrayBuffer()
        } else {
          // Distinguish a blocked/denied S3 GET (CORS/403) from a bad file: a
          // failed fetch throws, a non-2xx gives a clear `fetch <status>`.
          const res = await fetch(url!)
          if (!res.ok) throw new Error(`fetch ${res.status}`)
          buffer = await res.arrayBuffer()
        }
        const geo = prepare(buffer)
        if (!cancelled) {
          setGeometry(geo)
          setLoading(false)
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
    <div className={`relative ${className ?? ''}`}>
      <Canvas frameloop="demand" dpr={[1, 2]} camera={{ position: [0, 0, 3], fov: 45 }}>
        <color attach="background" args={['#0e1626']} />
        <ambientLight intensity={0.65} />
        <directionalLight position={[4, 5, 6]} intensity={0.9} />
        <directionalLight position={[-4, -3, -5]} intensity={0.35} />
        {geometry && (
          <Scene
            geometry={geometry}
            annotations={pins}
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
        )}
        <OrbitControls makeDefault enableDamping={false} enablePan enableZoom enableRotate />
        <FrameOnChange signal={`${pins.length}:${addMode}:${draft ? 1 : 0}:${selectedId ?? ''}`} />
      </Canvas>

      {/* Annotation controls (only when the caller wired up create). */}
      {canAnnotate && geometry && !error && (
        <div className="absolute left-2 top-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setSelectedId(null)
              setDraft(null)
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
          {addMode && (
            <button
              type="button"
              onClick={() => {
                setAddMode(false)
                setDraft(null)
              }}
              className="rounded-lg bg-black/40 px-2.5 py-1.5 text-xs text-white/80 backdrop-blur-sm transition hover:bg-black/60"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {loading && <Overlay>Loading scan…</Overlay>}
      {error && <Overlay tone="error">{error}</Overlay>}
      {!loading && !error && !geometry && <Overlay>No scan loaded</Overlay>}
    </div>
  )
}

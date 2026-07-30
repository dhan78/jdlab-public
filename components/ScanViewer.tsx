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
import { useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import type { BufferGeometry } from 'three'

interface ScanViewerProps {
  /** URL to an STL served over HTTP. Used only when no `file` is given. */
  url?: string
  /** A local File (drag-and-drop / picker). Takes precedence over `url`. */
  file?: File | null
  className?: string
}

// Parse an STL ArrayBuffer into a centered, normalized geometry.
function prepare(buffer: ArrayBuffer): BufferGeometry {
  const geo = new STLLoader().parse(buffer)
  geo.center() // recenter on the origin so the camera framing is consistent
  if (!geo.getAttribute('normal')) geo.computeVertexNormals()
  geo.computeBoundingSphere()
  return geo
}

function Model({ geometry }: { geometry: BufferGeometry }) {
  // Normalize to a consistent on-screen size regardless of the scan's real units.
  const radius = geometry.boundingSphere?.radius ?? 1
  const scale = radius > 0 ? 1.4 / radius : 1
  return (
    <mesh geometry={geometry} scale={scale}>
      <meshStandardMaterial color="#c9d4e0" roughness={0.5} metalness={0.05} />
    </mesh>
  )
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

export default function ScanViewer({ url, file, className }: ScanViewerProps) {
  const [geometry, setGeometry] = useState<BufferGeometry | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setError(null)
    setGeometry(null)
    if (!file && !url) return

    setLoading(true)
    const run = async () => {
      try {
        const buffer = file ? await file.arrayBuffer() : await (await fetch(url!)).arrayBuffer()
        const geo = prepare(buffer)
        if (!cancelled) {
          setGeometry(geo)
          setLoading(false)
        }
      } catch {
        if (!cancelled) {
          setError('Could not load or parse this STL file.')
          setLoading(false)
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
        {geometry && <Model geometry={geometry} />}
        <OrbitControls makeDefault enableDamping={false} enablePan enableZoom enableRotate />
      </Canvas>

      {loading && <Overlay>Loading scan…</Overlay>}
      {error && <Overlay tone="error">{error}</Overlay>}
      {!loading && !error && !geometry && <Overlay>No scan loaded</Overlay>}
    </div>
  )
}

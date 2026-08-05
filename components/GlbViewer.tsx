'use client'

/**
 * GLB preview viewer — renders a Meshopt-compressed GLB (our converted scans)
 * with adjustable lighting/tone-mapping so we can dial in a look that reads well
 * for color intraoral scans (which tend to look over-lit at default exposure).
 *
 * Client + WebGL only — import via next/dynamic with { ssr: false }.
 */
import { Suspense, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF, Bounds } from '@react-three/drei'
import type { ToneMapping } from 'three'

export interface GlbViewerProps {
  url: string
  exposure: number
  ambient: number
  keyLight: number
  toneMapping: ToneMapping
  background: string
}

function Model({ url }: { url: string }) {
  // useDraco=false (our GLBs are Meshopt, not Draco → no CDN decoder fetch),
  // useMeshopt=true (default) wires the bundled MeshoptDecoder.
  const { scene } = useGLTF(url, false)
  return <primitive object={scene} />
}

// Apply tone mapping + exposure live (so the slider updates without a reload).
function ToneControls({ toneMapping, exposure }: { toneMapping: ToneMapping; exposure: number }) {
  const gl = useThree(s => s.gl)
  const invalidate = useThree(s => s.invalidate)
  useEffect(() => {
    // Mutating the renderer is the standard R3F way to set these reactively.
    /* eslint-disable react-hooks/immutability */
    gl.toneMapping = toneMapping
    gl.toneMappingExposure = exposure
    /* eslint-enable react-hooks/immutability */
    invalidate()
  }, [gl, toneMapping, exposure, invalidate])
  return null
}

export default function GlbViewer({ url, exposure, ambient, keyLight, toneMapping, background }: GlbViewerProps) {
  return (
    <Canvas frameloop="demand" dpr={[1, 2]} camera={{ position: [0, 0, 3], fov: 45 }} gl={{ antialias: true }}>
      <color attach="background" args={[background]} />
      <ambientLight intensity={ambient} />
      <hemisphereLight args={['#ffffff', '#3a3a3a', ambient]} />
      <directionalLight position={[4, 6, 6]} intensity={keyLight} />
      <directionalLight position={[-5, -2, -4]} intensity={keyLight * 0.35} />
      <Suspense fallback={null}>
        {/* Auto-fit + center any scan regardless of its real-world scale/offset. */}
        <Bounds fit clip observe margin={1.2}>
          <Model url={url} />
        </Bounds>
      </Suspense>
      <OrbitControls makeDefault enableDamping={false} />
      <ToneControls toneMapping={toneMapping} exposure={exposure} />
    </Canvas>
  )
}

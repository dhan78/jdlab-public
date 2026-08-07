'use client'

/**
 * GLB preview + look-tuning page. Drop a converted `.glb` (from scripts/
 * convert-scan.mjs) to preview it, and tune exposure / lighting / tone mapping
 * until color scans look right. The chosen values are shown so we can bake them
 * into the production viewer.
 */
import { useCallback, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  ACESFilmicToneMapping,
  AgXToneMapping,
  NeutralToneMapping,
  NoToneMapping,
  type ToneMapping,
} from 'three'

const GlbViewer = dynamic(() => import('@/components/GlbViewer'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading viewer…</div>
  ),
})

const TONE_OPTIONS: { label: string; value: ToneMapping }[] = [
  { label: 'Neutral (KHR)', value: NeutralToneMapping },
  { label: 'None', value: NoToneMapping },
  { label: 'ACES Filmic', value: ACESFilmicToneMapping },
  { label: 'AgX', value: AgXToneMapping },
]

export default function GlbPreviewPage() {
  const [url, setUrl] = useState<string | undefined>(undefined)
  const [name, setName] = useState<string>('')
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const [exposure, setExposure] = useState(1)
  const [ambient, setAmbient] = useState(0.6)
  const [keyLight, setKeyLight] = useState(0.9)
  const [toneIdx, setToneIdx] = useState(0)
  const [background, setBackground] = useState('#0e1626')

  const pickFile = (f?: File | null) => {
    if (!f || !/\.glb$/i.test(f.name)) return
    const objUrl = URL.createObjectURL(f)
    setUrl(prev => {
      if (prev) URL.revokeObjectURL(prev)
      return objUrl
    })
    setName(f.name)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    pickFile(e.dataTransfer.files?.[0])
  }, [])

  const toneMapping = TONE_OPTIONS[toneIdx].value
  const settings = useMemo(
    () => ({ exposure: +exposure.toFixed(3), ambient: +ambient.toFixed(2), keyLight: +keyLight.toFixed(2), toneMapping: TONE_OPTIONS[toneIdx].label, background }),
    [exposure, ambient, keyLight, toneIdx, background]
  )

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">GLB preview &amp; look tuning</h1>
      <p className="mt-1 text-sm text-slate-500">
        Drop a converted <code className="rounded bg-slate-100 px-1">.glb</code> and tune the look. Orbit: drag ·
        Zoom: scroll · Pan: right-drag.
      </p>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_260px]">
        {/* Viewer / drop zone */}
        <div
          onDragOver={e => {
            e.preventDefault()
            if (!dragOver) setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`relative h-[520px] overflow-hidden rounded-xl border bg-slate-900 ${
            dragOver ? 'border-primary ring-2 ring-primary/40' : 'border-slate-200'
          }`}
        >
          {url ? (
            <GlbViewer
              url={url}
              exposure={exposure}
              ambient={ambient}
              keyLight={keyLight}
              toneMapping={toneMapping}
              background={background}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400">
              <p className="text-sm">Drop a .glb here, or</p>
              <button type="button" onClick={() => inputRef.current?.click()} className="btn-primary">
                Choose GLB…
              </button>
            </div>
          )}
          {name && (
            <span className="pointer-events-none absolute left-3 top-3 rounded bg-black/40 px-2 py-1 text-xs text-white/90">
              {name}
            </span>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".glb,model/gltf-binary"
            className="sr-only"
            onChange={e => pickFile(e.target.files?.[0])}
          />
        </div>

        {/* Controls */}
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <Slider label="Exposure" value={exposure} min={0.05} max={2.5} step={0.01} onChange={setExposure} />
          <Slider label="Ambient" value={ambient} min={0} max={3} step={0.05} onChange={setAmbient} />
          <Slider label="Key light" value={keyLight} min={0} max={3} step={0.05} onChange={setKeyLight} />
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Tone mapping</span>
            <select
              value={toneIdx}
              onChange={e => setToneIdx(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              {TONE_OPTIONS.map((o, i) => (
                <option key={o.label} value={i}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Background</span>
            <input
              type="color"
              value={background}
              onChange={e => setBackground(e.target.value)}
              className="mt-1 h-8 w-full rounded border border-slate-300"
            />
          </label>

          <div className="rounded-lg bg-slate-50 p-2 text-[11px] leading-relaxed text-slate-600">
            <p className="mb-1 font-semibold text-slate-700">Chosen settings</p>
            <pre className="whitespace-pre-wrap break-words">{JSON.stringify(settings, null, 2)}</pre>
          </div>
        </div>
      </div>
    </main>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-xs font-medium text-slate-600">
        {label} <span className="tabular-nums text-slate-400">{value.toFixed(2)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-primary"
      />
    </label>
  )
}

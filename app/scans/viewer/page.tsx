'use client'

/**
 * STL scan viewer test page. Drop in (or pick) a local .stl to preview it, or
 * load the bundled sample. The viewer is dynamically imported with ssr:false
 * because it needs WebGL and must not server-render.
 */
import { useCallback, useRef, useState } from 'react'
import dynamic from 'next/dynamic'

const ScanViewer = dynamic(() => import('@/components/ScanViewer'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading viewer…</div>
  ),
})

const SAMPLE_URL = '/samples/sample-scan.stl'

export default function ScanViewerTestPage() {
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState<string | undefined>(undefined)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const pickFile = (f?: File | null) => {
    if (f && /\.stl$/i.test(f.name)) {
      setFile(f)
      setUrl(undefined)
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    pickFile(e.dataTransfer.files?.[0])
  }, [])

  const clear = () => {
    setFile(null)
    setUrl(undefined)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">STL scan viewer</h1>
      <p className="mt-1 text-slate-500">
        Drop in an <code className="rounded bg-slate-100 px-1">.stl</code> file (or pick one) to preview it.
        Orbit: drag · Zoom: scroll/pinch · Pan: right-drag.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => inputRef.current?.click()} className="btn-primary">
          Choose STL…
        </button>
        <button type="button" onClick={() => { setFile(null); setUrl(SAMPLE_URL) }} className="btn-secondary">
          Load sample
        </button>
        <button
          type="button"
          onClick={clear}
          disabled={!file && !url}
          className="text-sm text-slate-500 hover:text-primary disabled:opacity-40"
        >
          Clear
        </button>
        {file && <span className="text-sm text-slate-500">{file.name} · {(file.size / 1024).toFixed(0)} KB</span>}
        {url && !file && <span className="text-sm text-slate-500">sample-scan.stl</span>}
        <input
          ref={inputRef}
          type="file"
          accept=".stl,model/stl"
          className="hidden"
          onChange={e => pickFile(e.target.files?.[0])}
        />
      </div>

      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`mt-4 h-[70vh] overflow-hidden rounded-2xl border-2 transition-colors ${
          dragOver ? 'border-primary border-dashed' : 'border-slate-200'
        }`}
      >
        <ScanViewer file={file} url={url} className="h-full w-full" />
      </div>
    </main>
  )
}

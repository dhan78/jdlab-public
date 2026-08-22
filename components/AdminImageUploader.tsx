'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { IMAGE_COLLECTIONS } from '@/lib/image-collections'

interface StoredImage {
  name: string
  path: string
  size: number
}

interface CollectionGroup {
  key: string
  label: string
  managed: boolean
  images: StoredImage[]
}

const MAX_WIDTH = 2000 // hero/marketing images never need more
const WEBP_QUALITY = 0.82

function slugName(original: string): string {
  const stem = original.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return `${stem || 'image'}.webp`
}

// Resize + compress entirely in the browser (Canvas → WebP), so nothing large
// is uploaded and no server-side image library is needed.
function optimize(file: File): Promise<{ dataUrl: string; w: number; h: number; bytes: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, MAX_WIDTH / img.width)
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('canvas unavailable'))
      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        blob => {
          if (!blob) return reject(new Error('encode failed'))
          const reader = new FileReader()
          reader.onload = () => resolve({ dataUrl: String(reader.result), w, h, bytes: blob.size })
          reader.onerror = () => reject(reader.error)
          reader.readAsDataURL(blob)
        },
        'image/webp',
        WEBP_QUALITY,
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('not an image'))
    }
    img.src = url
  })
}

const fmtKB = (b: number) => `${Math.round(b / 1024)} KB`

export default function AdminImageUploader() {
  const [groups, setGroups] = useState<CollectionGroup[]>([])
  const [collection, setCollection] = useState(IMAGE_COLLECTIONS[0].key)
  const [drag, setDrag] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/portal/admin/images')
      if (!res.ok) throw new Error('load failed')
      const data = await res.json()
      setGroups(data.collections ?? [])
    } catch {
      setError('Could not list images.')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).filter(f => f.type.startsWith('image/'))
      if (list.length === 0) return
      setBusy(true)
      setError('')
      setMsg('')
      let ok = 0
      for (const file of list) {
        try {
          const { dataUrl, w, h, bytes } = await optimize(file)
          const name = slugName(file.name)
          const res = await fetch('/api/portal/admin/images', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ collection, name, dataUrl }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error ?? 'upload failed')
          ok++
          setMsg(`Saved ${name} — ${w}×${h}, ${fmtKB(bytes)}`)
        } catch (e) {
          setError(`${file.name}: ${e instanceof Error ? e.message : 'failed'}`)
        }
      }
      setBusy(false)
      if (ok) await load()
    },
    [collection, load],
  )

  const remove = async (collectionKey: string, name: string) => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(
        `/api/portal/admin/images?collection=${encodeURIComponent(collectionKey)}&name=${encodeURIComponent(name)}`,
        { method: 'DELETE' },
      )
      if (!res.ok) throw new Error((await res.json()).error ?? 'delete failed')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'delete failed')
    } finally {
      setBusy(false)
    }
  }

  const activeCollection = IMAGE_COLLECTIONS.find(c => c.key === collection) ?? IMAGE_COLLECTIONS[0]

  return (
    <div>
      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
      {msg && <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">{msg}</div>}

      <label className="block text-sm font-medium text-gray-700 mb-1">Where should these go?</label>
      <select
        value={collection}
        onChange={e => setCollection(e.target.value)}
        data-intent="marketing_image_collection"
        className="mb-3 w-full sm:w-72 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
      >
        {IMAGE_COLLECTIONS.map(c => (
          <option key={c.key} value={c.key}>
            {c.label}
          </option>
        ))}
      </select>

      <p className="text-sm text-gray-500 mb-4">
        {activeCollection.managed
          ? 'These appear on the site automatically — dropping one in adds it to the carousel, removing one takes it out.'
          : 'One-off page images. You reference these by path in a specific page.'}{' '}
        Resized to {MAX_WIDTH}px WebP <span className="font-medium">in your browser</span>, then saved &amp; committed.
      </p>

      <div
        onDragOver={e => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => {
          e.preventDefault()
          setDrag(false)
          void handleFiles(e.dataTransfer.files)
        }}
        onClick={() => inputRef.current?.click()}
        data-intent="marketing_image_drop"
        className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition ${
          drag ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-primary/60 hover:bg-gray-50'
        }`}
      >
        <svg className="w-8 h-8 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M12 16V4m0 0L8 8m4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" />
        </svg>
        <span className="text-sm font-medium text-gray-700">
          {busy ? 'Optimizing…' : `Drop images here for “${activeCollection.label}”, or click to choose`}
        </span>
        <span className="text-xs text-gray-400">JPG / PNG / WebP · auto-resized to {MAX_WIDTH}px WebP</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {groups.map(group => (
        <div key={group.key} className="mt-6">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-semibold text-gray-800">{group.label}</h3>
            {group.managed && (
              <span className="text-[11px] font-medium text-primary bg-primary/10 rounded px-1.5 py-0.5">shown on site</span>
            )}
            <span className="text-[11px] text-gray-400">{group.images.length}</span>
          </div>
          {group.images.length === 0 ? (
            <p className="text-xs text-gray-400">No images yet.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {group.images.map(img => (
                <div key={img.path} className="rounded-lg border border-gray-200 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.path} alt={img.name} className="w-full h-28 object-cover bg-gray-100" />
                  <div className="p-2">
                    <button
                      type="button"
                      onClick={() => navigator.clipboard?.writeText(img.path)}
                      data-intent="marketing_image_copy_path"
                      title="Copy path"
                      className="block w-full truncate text-left text-xs font-mono text-gray-700 hover:text-primary"
                    >
                      {img.path}
                    </button>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-[11px] text-gray-400">{fmtKB(img.size)}</span>
                      <button
                        type="button"
                        onClick={() => remove(group.key, img.name)}
                        data-intent="marketing_image_delete"
                        disabled={busy}
                        className="text-[11px] font-medium text-red-600 hover:text-red-700 disabled:opacity-60"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

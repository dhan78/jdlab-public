'use client'

/**
 * Renders an uploaded, self-contained HTML file (e.g. an exocad WebViewer
 * treatment-plan export) inline so a doctor/planner can verify the design in the
 * thread. The HTML is UNTRUSTED (an arbitrary uploaded file that runs its own JS
 * to drive a WebGL viewer), so it is isolated in a hardened sandbox.
 *
 * SECURITY (do not weaken without review):
 *   - `sandbox="allow-scripts"` and NO `allow-same-origin` → the document is
 *     forced into an opaque origin. Its scripts run (so the viewer works) but it
 *     CANNOT read our cookies/DOM/localStorage, make same-origin requests, submit
 *     forms, open popups, or navigate the top frame.
 *   - Served from a blob: URL (re-typed text/html) so large exports load cleanly
 *     and no markup is ever injected into our own document.
 */
import { useEffect, useRef, useState } from 'react'

export default function HtmlViewer({ dataUrl, className, onError, onLoad }: { dataUrl: string; className?: string; onError?: (detail: string) => void; onLoad?: () => void }) {
  const [src, setSrc] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const onErrorRef = useRef(onError)
  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])
  const onLoadRef = useRef(onLoad)
  useEffect(() => {
    onLoadRef.current = onLoad
  }, [onLoad])

  useEffect(() => {
    let objectUrl: string | null = null
    let cancelled = false
    setError(false)
    setSrc(null)

    // Base64 data: attachments → blob URL (handles multi-MB exports). A remote
    // (presigned) https URL can be framed directly.
    if (dataUrl.startsWith('data:')) {
      fetch(dataUrl)
        .then(r => r.blob())
        .then(b => {
          if (cancelled) return
          objectUrl = URL.createObjectURL(b.slice(0, b.size, 'text/html'))
          setSrc(objectUrl)
        })
        .catch(() => {
          if (!cancelled) {
            setError(true)
            onErrorRef.current?.('html viewer fetch failed')
          }
        })
    } else {
      setSrc(dataUrl)
    }

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [dataUrl])

  if (error) {
    return (
      <div className={`flex items-center justify-center text-sm text-red-500 ${className ?? ''}`}>
        Could not load the viewer file.
      </div>
    )
  }
  if (!src) {
    return (
      <div className={`flex items-center justify-center text-sm text-slate-400 ${className ?? ''}`}>
        Loading viewer…
      </div>
    )
  }
  return (
    <iframe
      src={src}
      className={className}
      title="Treatment plan viewer"
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      loading="lazy"
      onLoad={() => onLoadRef.current?.()}
    />
  )
}

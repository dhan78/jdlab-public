'use client'

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { StatusIcon } from './StatusIcon'
import {
  STATUS_META,
  STAGES_BY_TYPE,
  CASE_TYPE_LABELS,
  formatDoctorName,
  caseNeedsDetails,
  type CaseStatus,
  type CaseType,
} from '@/lib/case-meta'
import { computeSla, SLA_CHIP, type SlaConfigMap } from '@/lib/sla'
import { subscribeCaseEvents } from '@/lib/portal-stream'
import { track } from '@/lib/telemetry'
import dynamic from 'next/dynamic'
import HtmlViewer from './HtmlViewer'
import SleepyPuppy from './SleepyPuppy'
import CaseDetailsEditor from './CaseDetailsEditor'

// The 3D scan viewer is heavy + WebGL-only, so load it lazily and client-side
// only, and render it just for attachments that are actually models (.stl/.ply).
const ScanViewer = dynamic(() => import('./ScanViewer'), {
  ssr: false,
  loading: () => (
    <div className="flex h-72 items-center justify-center text-sm text-slate-400">Loading 3D viewer…</div>
  ),
})
const isModelFile = (name: string) => /\.(stl|ply|glb)$/i.test(name)
// exocad WebViewer (and similar tools) export a self-contained interactive HTML
// file for design / treatment-plan verification — render it inline, sandboxed.
const isHtmlViewer = (name: string) => /\.html?$/i.test(name)

type Role = 'doctor' | 'planner' | 'admin'

interface Attachment {
  id: string
  name: string
  mimeType: string
  size: number
  dataUrl: string
}

// A 3D surface pin on a model attachment or an auto-generated GLB preview.
interface Annotation {
  id: string
  attachmentId: string | null
  previewKey?: string | null
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

interface Message {
  id: string
  authorId: string
  authorName: string
  authorRole: Role
  body: string
  attachments: Attachment[]
  createdAt: string
}

interface CaseDetail {
  id: string
  caseNumber: string
  doctorName: string
  title: string
  patientName?: string
  surgeryDate?: string
  toothRef?: string
  material?: string
  scannerBrand?: string
  scanCaseId?: string
  scanLink?: string
  specialInstructions?: string
  shipToAddress?: string
  caseType: CaseType
  isRush?: boolean
  status: CaseStatus
  scanReceivedAt?: string
  createdAt: string
  updatedAt: string
  pinned?: boolean
}

const STATUSES: CaseStatus[] = STAGES_BY_TYPE.guide
const ROLE_LABELS: Record<Role, string> = {
  doctor: 'Doctor',
  planner: 'Planning',
  admin: 'Admin',
}

const ROLE_CHIP: Record<Role, string> = {
  doctor: 'bg-teal-50 text-teal-700 ring-teal-200',
  planner: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  admin: 'bg-slate-100 text-slate-600 ring-slate-200',
}

const ROLE_AVATAR: Record<Role, string> = {
  doctor: 'bg-teal-100 text-teal-700',
  planner: 'bg-indigo-100 text-indigo-700',
  admin: 'bg-slate-200 text-slate-600',
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function daysUntil(iso: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((new Date(`${iso}T00:00:00`).getTime() - today.getTime()) / 86_400_000)
}
function urgencyClass(iso: string, status: CaseStatus): string {
  if (status === 'shipped') return 'text-slate-600'
  const d = daysUntil(iso)
  if (d <= 7) return 'text-red-600'
  if (d <= 14) return 'text-amber-600'
  return 'text-slate-600'
}

function IconUser({ className = 'w-4 h-4' }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="10" cy="6.5" r="3" /><path d="M4 16c0-3 2.7-4.5 6-4.5s6 1.5 6 4.5" strokeLinecap="round" /></svg>)
}
function IconCalendar({ className = 'w-4 h-4' }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="3" y="4.5" width="14" height="12" rx="2" /><path d="M3 8h14M7 3v3M13 3v3" strokeLinecap="round" /></svg>)
}

// Pushpin icon: filled when pinned, outline when not. Matches the sidebar rail.
function IconMaximize({ className = 'w-4 h-4' }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M12 3h5v5M8 17H3v-5M17 3l-6 6M3 17l6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>)
}
function IconPin({ filled, className = 'w-4 h-4' }: { filled?: boolean; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 17v5" />
      <path d="M9 10.8V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v5.8a2 2 0 0 0 1.1 1.8l1.4.7a1 1 0 0 1 .5.9V16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-.1a1 1 0 0 1 .5-.9l1.4-.7A2 2 0 0 0 9 10.8Z" />
    </svg>
  )
}

// Emit a replayable client-side error into the telemetry pipeline. It rides the
// same `client_error` event the global handler uses, so it's flagged kind:'error'
// server-side and shows as a red row in the admin Session Timeline, right after
// the actions that led to it. PHI-safe: never include patient text or raw file
// names — only file extension, size, HTTP status, and app error messages.
function reportClientError(where: string, caseToken: string, message: string, extra?: Record<string, unknown>) {
  track('client_error', {
    where,
    caseToken,
    message: String(message ?? 'error').slice(0, 500),
    ...extra,
  })
}

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024        // inline base64 (no-S3 fallback)
const MAX_UPLOAD_BYTES = 150 * 1024 * 1024          // direct-to-S3 (presigned PUT)

// One-tap design sign-off. Posted as a normal, NON-BLOCKING thread message — it
// never gates the ship date (doctors don't want to be the bottleneck); the lab
// proceeds on the SLA clock. Issues just go through the normal comment thread.
const APPROVAL_MESSAGE = '✅ Approved the design'

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Attachment name for DISPLAY only — strip the trailing extension so the thread
// never advertises the underlying scan/storage format (.glb/.stl/.ply). The
// `download` attribute keeps the REAL filename so downloaded files still open.
function displayName(name: string): string {
  return name.replace(/\.[^./\\]+$/, '')
}

// Format an ISO date (YYYY-MM-DD) without timezone drift.
function formatDate(iso: string): string {
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

interface PendingAttachment {
  file: File
  name: string
  mimeType: string
  size: number
  dataUrl?: string // base64, small files only — used for the no-S3 fallback
}

// Full-screen image viewer with drag-to-pan (mouse + touch), pinch/scroll zoom,
// zoom controls, prev/next, download, and Esc/backdrop/✕ to close.
function Lightbox({
  items,
  index,
  onClose,
  onNav,
}: {
  items: Attachment[]
  index: number
  onClose: () => void
  onNav: (i: number) => void
}) {
  const item = items[index]
  const [scale, setScale] = useState(1)
  const [tx, setTx] = useState(0)
  const [ty, setTy] = useState(0)
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map())
  const pinch = useRef<{ dist: number; scale: number } | null>(null)
  const pan = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)

  const reset = useCallback(() => { setScale(1); setTx(0); setTy(0) }, [])
  const zoomBy = useCallback((f: number) => {
    setScale(prev => {
      const ns = Math.min(5, Math.max(1, prev * f))
      if (ns === 1) { setTx(0); setTy(0) }
      return ns
    })
  }, [])

  // Reset transform when the shown image changes.
  useEffect(() => { reset() }, [index, reset])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight' && index < items.length - 1) onNav(index + 1)
      else if (e.key === 'ArrowLeft' && index > 0) onNav(index - 1)
      else if (e.key === '+' || e.key === '=') zoomBy(1.25)
      else if (e.key === '-' || e.key === '_') zoomBy(0.8)
      else if (e.key === '0') reset()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, items.length, onClose, onNav, reset, zoomBy])

  const onPointerDown = (e: React.PointerEvent) => {
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale }
    } else {
      pan.current = { x: e.clientX, y: e.clientY, tx, ty }
    }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      setScale(Math.min(5, Math.max(1, pinch.current.scale * (dist / pinch.current.dist))))
    } else if (pointers.current.size === 1 && pan.current && scale > 1) {
      setTx(pan.current.tx + (e.clientX - pan.current.x))
      setTy(pan.current.ty + (e.clientY - pan.current.y))
    }
  }
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    if (pointers.current.size === 0) {
      pan.current = null
      if (scale <= 1) { setTx(0); setTy(0) }
    } else {
      const p = [...pointers.current.values()][0]
      pan.current = { x: p.x, y: p.y, tx, ty }
    }
  }

  if (!item) return null

  const canPan = scale > 1
  const iconBtn = 'w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center'

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm select-none"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={item.name}
    >
      {/* top bar */}
      <div className="absolute top-0 inset-x-0 flex items-center justify-between gap-3 p-4 text-white" onClick={e => e.stopPropagation()}>
        <span className="text-sm truncate">
          {item.name} <span className="text-white/50">({formatSize(item.size)})</span>
          {items.length > 1 && <span className="text-white/50"> · {index + 1}/{items.length}</span>}
        </span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <a href={item.dataUrl} download={item.name} data-intent="image_download" onClick={e => e.stopPropagation()} aria-label="Download" className={iconBtn}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </a>
          <button onClick={onClose} data-intent="lightbox_close" aria-label="Close" className={iconBtn}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>
          </button>
        </div>
      </div>

      {/* prev / next */}
      {index > 0 && (
        <button onClick={e => { e.stopPropagation(); onNav(index - 1) }} data-intent="image_prev" aria-label="Previous image" className="absolute left-3 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center">
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      )}
      {index < items.length - 1 && (
        <button onClick={e => { e.stopPropagation(); onNav(index + 1) }} data-intent="image_next" aria-label="Next image" className="absolute right-3 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center">
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      )}

      {/* image stage (pan + pinch + wheel-zoom) */}
      <div
        className="max-w-[92vw] max-h-[86vh] overflow-hidden flex items-center justify-center"
        style={{ touchAction: 'none' }}
        onClick={e => e.stopPropagation()}
        onWheel={e => zoomBy(e.deltaY < 0 ? 1.12 : 0.89)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => (scale > 1 ? reset() : setScale(2))}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.dataUrl}
          alt={item.name}
          draggable={false}
          className="rounded-lg shadow-2xl max-w-[92vw] max-h-[86vh]"
          style={{
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            cursor: canPan ? 'grab' : 'zoom-in',
          }}
        />
      </div>

      {/* zoom controls */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-white/10 backdrop-blur px-2 py-1 text-white" onClick={e => e.stopPropagation()}>
        <button onClick={() => zoomBy(0.8)} data-intent="lightbox_zoom_out" aria-label="Zoom out" className="w-9 h-9 rounded-full hover:bg-white/20 flex items-center justify-center">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M8 11h6M20 20l-3.5-3.5" strokeLinecap="round" /></svg>
        </button>
        <span className="w-12 text-center text-xs tabular-nums">{Math.round(scale * 100)}%</span>
        <button onClick={() => zoomBy(1.25)} data-intent="lightbox_zoom_in" aria-label="Zoom in" className="w-9 h-9 rounded-full hover:bg-white/20 flex items-center justify-center">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M11 8v6M8 11h6M20 20l-3.5-3.5" strokeLinecap="round" /></svg>
        </button>
        <button onClick={reset} data-intent="lightbox_zoom_reset" aria-label="Reset zoom" className="w-9 h-9 rounded-full hover:bg-white/20 flex items-center justify-center">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 9V4h5M20 15v5h-5M20 9V4h-5M4 15v5h5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>

      {/* interaction hint */}
      <div className="absolute bottom-[4.5rem] left-1/2 -translate-x-1/2 text-[11px] text-white/40 pointer-events-none whitespace-nowrap">
        Drag to pan · scroll or pinch to zoom · double-click to reset
      </div>
    </div>
  )
}

// Mounts its (WebGL) child only while near the viewport and unmounts it once
// scrolled well away, so a case with many 3D previews never holds more than a
// few live WebGL contexts at once. Browsers cap contexts (~8 on mobile); over
// the cap the oldest is force-lost and its pins vanish — the bug this prevents.
function ViewportCanvas({ children, placeholder }: { children: ReactNode; placeholder?: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: '300px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={ref} className="h-full w-full">
      {inView ? children : placeholder}
    </div>
  )
}

export default function CaseThread({
  caseId,
  currentUserId,
  currentUserRole,
}: {
  caseId: string
  currentUserId: string
  currentUserRole: Role
}) {
  const [caseDetail, setCaseDetail] = useState<CaseDetail | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // A missing/forbidden case (404/403) is a calm, expected state — not an error.
  // Tracked separately so we render a neutral panel and DON'T log it.
  const [caseGone, setCaseGone] = useState(false)
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  // Live clock so the SLA chip recomputes on its own as time passes.
  const [now, setNow] = useState(() => new Date())
  const [slaConfig, setSlaConfig] = useState<SlaConfigMap>({})
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const [body, setBody] = useState('')
  const [pending, setPending] = useState<PendingAttachment[]>([])
  const [approving, setApproving] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [statusSaving, setStatusSaving] = useState(false)
  const [editingDetails, setEditingDetails] = useState(false)
  const [glbPreviews, setGlbPreviews] = useState<{ id: string; name: string; url: string; size: number }[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const [lightbox, setLightbox] = useState<{ items: Attachment[]; index: number } | null>(null)
  // Attachment currently expanded to a full-window viewer (STL/PLY or HTML).
  const [maximized, setMaximized] = useState<Attachment | null>(null)
  // A GLB preview expanded to a full-window (annotatable) viewer.
  const [maximizedPreview, setMaximizedPreview] = useState<{ id: string; name: string; url: string; size: number } | null>(null)
  // 3D surface pins for this case, grouped client-side by attachment id.
  const [annotations, setAnnotations] = useState<Annotation[]>([])

  // Close the full-window viewer on Escape.
  useEffect(() => {
    if (!maximized && !maximizedPreview) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setMaximized(null); setMaximizedPreview(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [maximized, maximizedPreview])

  // While a viewer is maximized: lock page scroll (so a touch-drag can't pan the
  // page underneath) and disable horizontal overscroll history-nav (swipe-left to
  // the previous case). That nav gesture is governed by <html>, not <body>.
  useEffect(() => {
    if (!maximized && !maximizedPreview) return
    const body = document.body.style
    const root = document.documentElement.style
    const prev = {
      bodyOverflow: body.overflow,
      bodyOverscroll: body.overscrollBehavior,
      rootOverscroll: root.overscrollBehavior,
    }
    body.overflow = 'hidden'
    body.overscrollBehavior = 'none'
    root.overscrollBehavior = 'none'
    return () => {
      body.overflow = prev.bodyOverflow
      body.overscrollBehavior = prev.bodyOverscroll
      root.overscrollBehavior = prev.rootOverscroll
    }
  }, [maximized, maximizedPreview])

  // Load 3D annotations for the case (visible to both doctor and lab). Refetched
  // after each create/delete keeps the numbered badges consistent.
  const loadAnnotations = useCallback(async () => {
    try {
      const res = await fetch(`/api/portal/cases/${caseId}/annotations`)
      if (res.ok) {
        const data = await res.json()
        const list: Annotation[] = Array.isArray(data.annotations) ? data.annotations : []
        setAnnotations(list)
        // Breadcrumb: on a "pins vanished" reopen, this says whether the DATA was
        // present (count>0) or empty, and how the pins are anchored — so we can
        // tell a data/fetch problem from a pure render problem.
        track('annotations_loaded', {
          caseId,
          count: list.length,
          withPreviewKey: list.filter(a => a.previewKey).length,
          withAttachmentId: list.filter(a => a.attachmentId).length,
        })
      } else {
        // Surface WHY pins vanished (401/429/5xx) instead of silently dropping them.
        reportClientError('annotations_load', caseId, `status ${res.status}`, { status: res.status })
      }
    } catch (e) {
      reportClientError('annotations_load', caseId, e instanceof Error ? e.message : 'annotations load failed')
    }
  }, [caseId])

  useEffect(() => {
    // Clear the previous case's pins IMMEDIATELY (before the async load), so
    // stale annotations can't bleed onto a new case while its own load is in
    // flight — cases can share the same GLB scan (same previewKey), which made
    // that leak visible as pins appearing on cases that have none / vanishing.
    setAnnotations([])
    void loadAnnotations()
  }, [loadAnnotations])

  // Create a pin on a specific model attachment at a picked surface point.
  const createAnnotation = useCallback(
    async (
      attachmentId: string,
      p: {
        x: number; y: number; z: number; body: string
        kind?: string; bx?: number; by?: number; bz?: number
      }
    ) => {
      try {
        const res = await fetch(`/api/portal/cases/${caseId}/annotations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ attachmentId, ...p }),
        })
        if (res.ok) {
          const data = await res.json()
          if (data.annotation) setAnnotations(prev => [...prev, data.annotation])
          // PHI-safe: kind + note LENGTH only, never the note text.
          track('annotation_add', { caseId, kind: p.kind ?? 'pin', len: p.body.length })
        } else {
          reportClientError('annotation_create', caseId, `status ${res.status}`, { status: res.status })
        }
      } catch (e) {
        reportClientError('annotation_create', caseId, e instanceof Error ? e.message : 'create failed')
      }
    },
    [caseId]
  )

  // Create a pin on a GLB preview (anchored by its S3 key, not an attachment id).
  const createPreviewAnnotation = useCallback(
    async (
      previewKey: string,
      p: {
        x: number; y: number; z: number; body: string
        kind?: string; bx?: number; by?: number; bz?: number
      }
    ) => {
      try {
        const res = await fetch(`/api/portal/cases/${caseId}/annotations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ previewKey, ...p }),
        })
        if (res.ok) {
          const data = await res.json()
          if (data.annotation) setAnnotations(prev => [...prev, data.annotation])
          track('annotation_add', { caseId, kind: p.kind ?? 'pin', len: p.body.length })
        } else {
          reportClientError('annotation_create', caseId, `status ${res.status}`, { status: res.status })
        }
      } catch (e) {
        reportClientError('annotation_create', caseId, e instanceof Error ? e.message : 'create failed')
      }
    },
    [caseId]
  )

  // Delete a pin (author-only, or admin — enforced server-side).
  const deleteAnnotation = useCallback(
    async (annId: string) => {
      try {
        const res = await fetch(`/api/portal/cases/${caseId}/annotations/${annId}`, { method: 'DELETE' })
        if (res.ok) {
          setAnnotations(prev => prev.filter(a => a.id !== annId))
          track('annotation_remove', { caseId })
        } else reportClientError('annotation_delete', caseId, `status ${res.status}`, { status: res.status })
      } catch (e) {
        reportClientError('annotation_delete', caseId, e instanceof Error ? e.message : 'delete failed')
      }
    },
    [caseId]
  )

  // Realtime "typing" indicator for the other participant.
  const [typingName, setTypingName] = useState<string | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const typingClearRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTypingSentRef = useRef(0)
  const lastReadRef = useRef(0)

  const isLab = currentUserRole === 'planner' || currentUserRole === 'admin'
  // Design already signed off? (doctor posted the approval at least once)
  const hasApproved = messages.some(m => m.authorRole === 'doctor' && m.body === APPROVAL_MESSAGE)

  // Mark this case read for the current user (fire-and-forget) and let the
  // dashboard/sidebar refresh their unread badges. Throttled so a burst of
  // incoming messages doesn't spam /read + refetch; `force` bypasses it on open.
  const markRead = useCallback((force = false) => {
    const now = Date.now()
    if (!force && now - lastReadRef.current < 3000) return
    lastReadRef.current = now
    void fetch(`/api/portal/cases/${caseId}/read`, { method: 'POST' })
      .then(() => window.dispatchEvent(new Event('cases:changed')))
      .catch(() => {})
  }, [caseId])

  // Mark this case unread again (explicit — mirrors the read action). Lives in
  // the conversation header, not the list.
  const markUnread = useCallback(() => {
    void fetch(`/api/portal/cases/${caseId}/read`, { method: 'DELETE' })
      .then(() => window.dispatchEvent(new Event('cases:changed')))
      .catch(() => {})
  }, [caseId])

  const fetchThread = useCallback(async () => {
    setLoading(true)
    setError('')
    setCaseGone(false)
    try {
      const res = await fetch(`/api/portal/cases/${caseId}`)
      // 404 (missing/deleted) and 403 (not yours) are expected, benign states —
      // show a friendly panel, and do NOT report them as client errors.
      if (res.status === 404 || res.status === 403) {
        setCaseGone(true)
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to load case')
      }
      const data = await res.json()
      setCaseDetail(data.case)
      setMessages(data.messages ?? [])
      setSlaConfig(data.slaConfig ?? {})
      setUnreadCount(data.unreadCount ?? 0)
      setGlbPreviews(data.glbPreviews ?? [])
      // This GET recorded a case.view (audit); nudge the recently-viewed rail +
      // list to refresh so the just-opened case surfaces at the top. (Opening no
      // longer marks the case read, so this refresh had to be decoupled from it.)
      window.dispatchEvent(new Event('cases:changed'))
    } catch (e) {
      reportClientError('case_load', caseId, e instanceof Error ? e.message : 'load failed', {
        stack: e instanceof Error ? e.stack?.slice(0, 2000) : undefined,
      })
      setError(e instanceof Error ? e.message : 'Could not load this case.')
    } finally {
      setLoading(false)
    }
  }, [caseId])

  useEffect(() => { fetchThread() }, [fetchThread])

  // Silent refetch of the WHOLE case (status + messages + SLA) without the
  // loading skeleton — used by the live stream and on refocus. Refetching the
  // full case (not just /messages) means a planner's STATUS change reflects on
  // the doctor's page live, not only when a new message arrives.
  const refreshCase = useCallback(async () => {
    try {
      const res = await fetch(`/api/portal/cases/${caseId}`)
      if (!res.ok) return
      const data = await res.json()
      setCaseDetail(data.case)
      setMessages(data.messages ?? [])
      setSlaConfig(data.slaConfig ?? {})
      setUnreadCount(data.unreadCount ?? 0)
      setGlbPreviews(data.glbPreviews ?? [])
    } catch {
      /* transient; the stream will prompt again on the next update */
    }
  }, [caseId])

  // Refetch this thread when the tab regains focus/visibility. A backgrounded
  // mobile tab freezes and drops the SSE stream, so on reopen the conversation
  // can be stale — pull the latest messages.
  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === 'visible') void refreshCase()
    }
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onFocus)
      window.removeEventListener('focus', onFocus)
    }
  }, [refreshCase])

  // Realtime updates via the single shared stream: refetch messages when this
  // case gets a new message, and show the typing indicator. One connection is
  // shared app-wide (see lib/portal-stream), so no per-case EventSource.
  useEffect(() => {
    const unsub = subscribeCaseEvents(ev => {
      if (ev.caseId !== caseId) return
      if (ev.event === 'update') {
        void refreshCase()
        return
      }
      if (ev.event === 'typing') {
        const { userId, name } = (ev.data ?? {}) as { userId?: string; name?: string }
        if (!userId || userId === currentUserId) return // ignore our own typing
        setTypingName(name ?? 'Someone')
        if (typingClearRef.current) clearTimeout(typingClearRef.current)
        typingClearRef.current = setTimeout(() => setTypingName(null), 4000)
      }
    })
    return () => {
      unsub()
      if (typingClearRef.current) clearTimeout(typingClearRef.current)
    }
  }, [caseId, refreshCase, currentUserId])

  // Tell the server we're typing — throttled to at most once every 2.5s.
  const notifyTyping = useCallback(() => {
    const now = Date.now()
    if (now - lastTypingSentRef.current < 2500) return
    lastTypingSentRef.current = now
    void fetch(`/api/portal/cases/${caseId}/typing`, { method: 'POST' }).catch(() => {})
  }, [caseId])

  const handleFiles = async (files: FileList | null, source: 'picker' | 'drop' | 'paste' = 'picker') => {
    if (!files) return
    setSendError('')
    const next: PendingAttachment[] = []
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (file.size > MAX_UPLOAD_BYTES) {
        reportClientError('attach_too_large', caseId, 'file exceeds upload limit', {
          ext, size: file.size, limit: MAX_UPLOAD_BYTES, validation: true,
        })
        setSendError(`"${file.name}" exceeds the ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB limit.`)
        continue
      }
      // Only small files are base64-read (for the no-S3 fallback); large files
      // upload straight to S3 at send time, so we keep just the File here.
      let dataUrl: string | undefined
      if (file.size <= MAX_ATTACHMENT_BYTES) {
        try {
          dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = () => reject(reader.error)
            reader.readAsDataURL(file)
          })
        } catch (err) {
          reportClientError('attach_read', caseId, err instanceof Error ? err.message : 'file read failed', {
            ext, size: file.size,
          })
          setSendError(`Could not read "${file.name}". Please try again.`)
          continue
        }
      }
      // PHI-safe activity signal: record that a file was attached — extension,
      // size, and how it was added — but NEVER the filename. Patient names
      // commonly live in scan filenames, so they must not enter telemetry.
      track('attach_add', { caseId, ext, size: file.size, source })
      next.push({ file, name: file.name, mimeType: file.type, size: file.size, dataUrl })
    }
    setPending(prev => [...prev, ...next])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removePending = (index: number) => {
    setPending(prev => prev.filter((_, i) => i !== index))
  }

  // Drag-and-drop + paste attach: both reuse handleFiles (size caps + S3/base64
  // path). Text paste is left alone — we only act when files are present.
  const onDragOverFiles = (e: React.DragEvent) => {
    e.preventDefault()
    if (!dragActive) setDragActive(true)
  }
  const onDragLeaveFiles = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
  }
  const onDropFiles = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    if (e.dataTransfer?.files?.length) void handleFiles(e.dataTransfer.files, 'drop')
  }
  const onPasteFiles = (e: React.ClipboardEvent) => {
    if (e.clipboardData?.files?.length) void handleFiles(e.clipboardData.files, 'paste')
  }

  // Resolve one pending file into a message attachment: upload directly to S3
  // via a presigned PUT when configured, else fall back to inline base64 (small
  // files only). Returns null (and surfaces an error) if it can't be attached.
  const resolveAttachment = async (
    p: PendingAttachment
  ): Promise<{ name: string; mimeType: string; size: number; s3Key?: string; dataUrl?: string } | null> => {
    const meta = { name: p.name, mimeType: p.mimeType, size: p.size }
    const pres = await fetch(`/api/portal/cases/${caseId}/attachments/presign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(meta),
    })
    if (pres.ok) {
      const { uploadUrl, key, contentType } = await pres.json()
      const put = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: p.file,
      })
      if (!put.ok) {
        reportClientError('attach_upload', caseId, 'S3 PUT failed', {
          status: put.status, ext: p.name.split('.').pop()?.toLowerCase(), size: p.size,
        })
        setSendError(`Upload of "${p.name}" failed. Please try again.`)
        return null
      }
      return { ...meta, s3Key: key }
    }
    if (pres.status === 501) {
      // Direct upload not configured (dev): base64 fallback for small files only.
      if (p.dataUrl) return { ...meta, dataUrl: p.dataUrl }
      reportClientError('attach_unsupported', caseId, 'no direct upload; too large for base64 fallback', {
        ext: p.name.split('.').pop()?.toLowerCase(), size: p.size, validation: true,
      })
      setSendError(`"${p.name}" is too large to attach in this environment.`)
      return null
    }
    const err = await pres.json().catch(() => ({}))
    reportClientError('attach_presign', caseId, err.error ?? 'presign failed', {
      status: pres.status, ext: p.name.split('.').pop()?.toLowerCase(), size: p.size,
    })
    setSendError(err.error ?? `Could not prepare upload for "${p.name}".`)
    return null
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!body.trim() && pending.length === 0) return
    setSending(true)
    setSendError('')
    try {
      const resolved: Array<{ name: string; mimeType: string; size: number; s3Key?: string; dataUrl?: string }> = []
      for (const p of pending) {
        const r = await resolveAttachment(p)
        if (!r) return // error already surfaced; keep the composer state
        resolved.push(r)
      }
      const res = await fetch(`/api/portal/cases/${caseId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: body.trim(), attachments: resolved }),
      })
      const data = await res.json()
      if (res.ok) {
        // PHI-safe: body length (not text) + per-attachment ext/size (not names).
        track('message_send', {
          caseId,
          len: body.trim().length,
          attachments: resolved.length,
          exts: resolved.map(r => r.name.split('.').pop()?.toLowerCase()),
          bytes: resolved.reduce((sum, r) => sum + r.size, 0),
        })
        setMessages(data.messages ?? [])
        setBody('')
        setPending([])
      } else {
        reportClientError('message_send', caseId, data.error ?? 'send failed', {
          status: res.status, attachments: pending.length,
        })
        setSendError(data.error ?? 'Failed to send message.')
      }
    } catch (e) {
      reportClientError('message_send', caseId, e instanceof Error ? e.message : 'send failed', {
        stack: e instanceof Error ? e.stack?.slice(0, 2000) : undefined,
        attachments: pending.length,
      })
      setSendError('An unexpected error occurred.')
    } finally {
      setSending(false)
    }
  }

  // Dentist one-tap approval — a fast sign-off, not a gate. Posts the approval to
  // the thread (SSE + notifies the lab) without touching status or the SLA clock.
  const handleApprove = async () => {
    if (approving || sending) return
    setApproving(true)
    setSendError('')
    try {
      const res = await fetch(`/api/portal/cases/${caseId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: APPROVAL_MESSAGE }),
      })
      const data = await res.json()
      if (res.ok) {
        track('design_approved', { caseId })
        setMessages(data.messages ?? [])
      } else {
        reportClientError('design_approve', caseId, data.error ?? 'approve failed', { status: res.status })
        setSendError(data.error ?? 'Could not send approval.')
      }
    } catch (e) {
      reportClientError('design_approve', caseId, e instanceof Error ? e.message : 'approve failed', {
        stack: e instanceof Error ? e.stack?.slice(0, 2000) : undefined,
      })
      setSendError('An unexpected error occurred.')
    } finally {
      setApproving(false)
    }
  }

  // Pin/unpin this case for the current user. Optimistic; reverts on failure and
  // records the failure into the telemetry pipeline like the other actions.
  const togglePin = async () => {
    if (!caseDetail) return
    const next = !caseDetail.pinned
    setCaseDetail(prev => (prev ? { ...prev, pinned: next } : prev))
    try {
      const res = await fetch(`/api/portal/cases/${caseId}/pin`, { method: next ? 'POST' : 'DELETE' })
      if (!res.ok) throw new Error(`pin ${res.status}`)
      track('case_pin', { caseId, pinned: next })
      window.dispatchEvent(new Event('cases:changed'))
    } catch (e) {
      setCaseDetail(prev => (prev ? { ...prev, pinned: !next } : prev))
      reportClientError('case_pin', caseId, e instanceof Error ? e.message : 'pin failed', { next })
    }
  }

  const handleStatusChange = async (status: CaseStatus) => {
    track('status_change', { caseId, status })
    setStatusSaving(true)
    try {
      const res = await fetch(`/api/portal/cases/${caseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json()
      if (res.ok && data.case) {
        setCaseDetail(data.case)
        // Refresh the persistent sidebar so its status dot updates.
        window.dispatchEvent(new Event('cases:changed'))
      } else {
        reportClientError('status_change', caseId, data.error ?? 'status change failed', {
          status: res.status, next: status,
        })
      }
    } catch (e) {
      reportClientError('status_change', caseId, e instanceof Error ? e.message : 'status change failed', {
        stack: e instanceof Error ? e.stack?.slice(0, 2000) : undefined, next: status,
      })
    } finally {
      setStatusSaving(false)
    }
  }

  // Planner/admin: start (or clear) the SLA clock by marking the scans received.
  const markScansReceived = async (received: boolean) => {
    track('scan_received', { caseId, received })
    setStatusSaving(true)
    try {
      const res = await fetch(`/api/portal/cases/${caseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanReceived: received }),
      })
      if (res.ok) {
        setCaseDetail(prev =>
          prev ? { ...prev, scanReceivedAt: received ? new Date().toISOString() : undefined } : prev
        )
        window.dispatchEvent(new Event('cases:changed'))
      } else {
        const data = await res.json().catch(() => ({}))
        reportClientError('scan_received', caseId, data.error ?? 'scan-received update failed', {
          status: res.status, received,
        })
      }
    } catch (e) {
      reportClientError('scan_received', caseId, e instanceof Error ? e.message : 'scan-received update failed', {
        stack: e instanceof Error ? e.stack?.slice(0, 2000) : undefined, received,
      })
    } finally {
      setStatusSaving(false)
    }
  }

  // Admin-only hard delete: wipes the case + its entire history and storage,
  // then leaves the view. Confirmed because it's irreversible.
  const deleteCase = async () => {
    if (currentUserRole !== 'admin') return
    const label = caseDetail?.caseNumber ?? 'this case'
    if (
      !window.confirm(
        `Permanently delete ${label}? This removes the case, its entire history, all attachments, and the scan files from storage. This cannot be undone.`
      )
    )
      return
    setDeleting(true)
    try {
      const res = await fetch(`/api/portal/cases/${caseId}`, { method: 'DELETE' })
      if (res.ok) {
        track('case_delete', { caseId })
        window.dispatchEvent(new Event('cases:changed'))
        router.push('/portal')
        return // navigating away — keep the button disabled
      }
      const data = await res.json().catch(() => ({}))
      reportClientError('case_delete', caseId, data.error ?? 'case delete failed', { status: res.status })
    } catch (e) {
      reportClientError('case_delete', caseId, e instanceof Error ? e.message : 'case delete failed', {})
    }
    setDeleting(false)
  }

  if (loading) {
    return (
      <p className="text-gray-500">Loading case…</p>
    )
  }

  if (caseGone) {
    return (
      <div className="flex min-h-full items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm text-center">
          <SleepyPuppy className="mx-auto h-32 w-32" />
          <h1 className="mt-5 text-xl font-bold text-slate-900">
            We couldn’t find that case
          </h1>
          <p className="mx-auto mt-2 max-w-xs text-sm text-slate-600">
            It may have been moved, or the link isn’t quite right. Pick a case
            from your list to jump back in.
          </p>
          <Link
            href="/portal"
            className="mt-6 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M12 5l-5 5 5 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to cases
          </Link>
        </div>
      </div>
    )
  }

  if (error || !caseDetail) {
    return (
      <div>
        <Link href="/portal" className="text-primary text-sm hover:underline">&larr; Back to cases</Link>
        <div role="alert" className="mt-4 p-4 rounded-lg bg-red-50 border border-red-300 text-red-700">
          {error || 'Case not found.'}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl overflow-x-clip">
        {editingDetails && caseDetail && (
          <CaseDetailsEditor
            caseToken={caseDetail.id}
            initial={{
              title: caseDetail.title,
              caseType: caseDetail.caseType,
              patientName: caseDetail.patientName,
              surgeryDate: caseDetail.surgeryDate,
              toothRef: caseDetail.toothRef,
              material: caseDetail.material,
              scannerBrand: caseDetail.scannerBrand,
              isRush: !!caseDetail.isRush,
              specialInstructions: caseDetail.specialInstructions,
            }}
            onClose={() => setEditingDetails(false)}
            onSaved={refreshCase}
          />
        )}
        <Link href="/portal" className="lg:hidden inline-flex items-center gap-1.5 text-slate-500 text-sm hover:text-primary transition-colors">
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 5l-5 5 5 5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Back to cases
        </Link>

        {/* Case header */}
        <div className="mt-4 mb-6 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          {caseNeedsDetails(caseDetail) && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-lg bg-amber-50 ring-1 ring-inset ring-amber-200 px-3 py-2">
              <span className="inline-flex items-center gap-2 text-sm text-amber-900">
                <svg className="w-4 h-4 flex-shrink-0 text-amber-500" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M10 3 2.5 16h15L10 3z" strokeLinejoin="round" /><path d="M10 8v3.5M10 13.7v.3" strokeLinecap="round" /></svg>
                New case from an incoming scan — add the patient &amp; tooth details.
              </span>
              <button type="button" onClick={() => setEditingDetails(true)} data-intent="case_details_open" className="shrink-0 text-xs font-semibold text-amber-800 bg-white ring-1 ring-amber-300 rounded-md px-2.5 py-1 hover:bg-amber-100">Add details</button>
            </div>
          )}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-3 flex-wrap">
                <span className="text-xs font-mono text-slate-400 tabular-nums">{caseDetail.caseNumber}</span>
                <h1 className="min-w-0 break-words text-xl sm:text-2xl font-bold tracking-tight text-slate-900">{caseDetail.title}</h1>
                <span className="text-xs font-medium text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">{CASE_TYPE_LABELS[caseDetail.caseType]}</span>
                {caseDetail.material && (
                  <span className="text-xs text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">{caseDetail.material}</span>
                )}
              </div>
              <div className="mt-2 flex items-center gap-4 flex-wrap text-sm">
                {caseDetail.patientName && (
                  <span className="inline-flex items-center gap-1.5 text-slate-600"><IconUser className="w-4 h-4 text-slate-400" /> {caseDetail.patientName}</span>
                )}
                {caseDetail.surgeryDate && (
                  <span className={`inline-flex items-center gap-1.5 font-medium ${urgencyClass(caseDetail.surgeryDate, caseDetail.status)}`}><IconCalendar className="w-4 h-4" /> Surgery {formatDate(caseDetail.surgeryDate)}</span>
                )}
                <span className="text-slate-500">{formatDoctorName(caseDetail.doctorName)}</span>
                {(() => {
                  const sla = computeSla(caseDetail, now, slaConfig)
                  if (sla.state === 'shipped') return null
                  return (
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ring-1 ring-inset ${SLA_CHIP[sla.state]}`}
                      title={sla.dueDate ? `Due ${new Date(sla.dueDate).toLocaleDateString()}` : 'Awaiting scan files'}
                    >
                      {sla.label}
                    </span>
                  )
                })()}
              </div>
              {(caseDetail.scannerBrand || caseDetail.scanCaseId) && (
                <div className="mt-2 flex items-center gap-2 flex-wrap text-sm">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 ring-1 ring-inset ring-slate-200 px-2.5 py-1 text-slate-600">
                    <svg className="w-4 h-4 text-slate-400" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 7V5.5A1.5 1.5 0 0 1 5.5 4H7M16 7V5.5A1.5 1.5 0 0 0 14.5 4H13M4 13v1.5A1.5 1.5 0 0 0 5.5 16H7M16 13v1.5A1.5 1.5 0 0 1 14.5 16H13" strokeLinecap="round" /><rect x="7" y="8" width="6" height="4" rx="1" /></svg>
                    Scan: {caseDetail.scannerBrand}
                    {caseDetail.scannerBrand && caseDetail.scanCaseId ? ' · ' : ''}
                    {caseDetail.scanCaseId && <span className="font-mono text-slate-700">{caseDetail.scanCaseId}</span>}
                  </span>
                  {caseDetail.scanLink && (
                    <a href={caseDetail.scanLink} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">Open in portal ↗</a>
                  )}
                </div>
              )}
              {caseDetail.specialInstructions && (
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 ring-1 ring-inset ring-amber-200 px-3 py-2 text-sm text-amber-900">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M10 3 2.5 16h15L10 3z" strokeLinejoin="round" /><path d="M10 8v3.5M10 13.7v.3" strokeLinecap="round" /></svg>
                  <span><span className="font-semibold">Special instructions: </span><span className="whitespace-pre-wrap">{caseDetail.specialInstructions}</span></span>
                </div>
              )}
              {caseDetail.shipToAddress && (
                <div className="mt-2 flex items-start gap-2 text-sm text-slate-600">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-400" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M10 17.5S4 12.5 4 8a6 6 0 1 1 12 0c0 4.5-6 9.5-6 9.5z" strokeLinejoin="round" /><circle cx="10" cy="8" r="2" /></svg>
                  <span><span className="font-semibold">Ship to: </span>{caseDetail.shipToAddress}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                data-intent="case_details_open"
                onClick={() => setEditingDetails(true)}
                title="Edit case details"
                aria-label="Edit case details"
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 13.5V16h2.5l7-7-2.5-2.5-7 7z" strokeLinejoin="round" /><path d="M11.5 6 14 8.5" strokeLinecap="round" /></svg>
                <span className="hidden sm:inline">Edit</span>
              </button>
              <button
                type="button"
                data-intent="case_pin_toggle"
                onClick={togglePin}
                title={caseDetail.pinned ? 'Unpin this case' : 'Pin this case to keep it in your recently-viewed list'}
                aria-label={caseDetail.pinned ? 'Unpin this case' : 'Pin this case'}
                aria-pressed={!!caseDetail.pinned}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition ${
                  caseDetail.pinned
                    ? 'border-primary bg-primary text-white hover:bg-primary/90'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-50 hover:text-primary'
                }`}
              >
                <IconPin filled={caseDetail.pinned} className="w-4 h-4" />
              </button>
              {(() => {
                const read = unreadCount === 0
                return (
                  <button
                    type="button"
                    onClick={() => { if (read) { markUnread(); setUnreadCount(1) } else { markRead(true); setUnreadCount(0) } }}
                    data-intent="case_read_toggle"
                    title={read ? 'Mark this case as unread' : 'Mark this case as read'}
                    aria-label={read ? 'Mark this case as unread' : 'Mark this case as read'}
                    className="inline-flex h-9 items-center gap-1.5 text-sm px-2.5 sm:px-3 rounded-lg border border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 transition"
                  >
                    {read ? (
                      <span className="w-2 h-2 rounded-full bg-accent" aria-hidden="true" />
                    ) : (
                      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 10.5l3.5 3.5L16 5.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    )}
                    <span className="hidden sm:inline">{read ? 'Mark unread' : `Mark read${unreadCount > 1 ? ` (${unreadCount})` : ''}`}</span>
                  </button>
                )
              })()}
              {isLab && !caseDetail.scanReceivedAt && caseDetail.status !== 'shipped' && (
                <button
                  type="button"
                  onClick={() => markScansReceived(true)}
                  data-intent="scans_received_mark"
                  disabled={statusSaving}
                  title="Mark that the scan files arrived — starts the turnaround clock"
                  className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 shadow-sm transition disabled:opacity-60"
                >
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 10.5l3.5 3.5L16 5.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  Scans received
                </button>
              )}
              {isLab ? (
                <label className="flex items-center gap-2 text-sm">
                  <span className="text-slate-500">Status</span>
                  <select
                    value={caseDetail.status}
                    disabled={statusSaving}
                    onChange={e => handleStatusChange(e.target.value as CaseStatus)}
                    className="px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm"
                    aria-label="Case status"
                  >
                    {(STAGES_BY_TYPE[caseDetail.caseType] ?? STATUSES).map(s => (
                      <option key={s} value={s}>{STATUS_META[s].label}</option>
                    ))}
                  </select>
                </label>
              ) : (
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ring-1 ring-inset ${STATUS_META[caseDetail.status].chip}`}>
                  <StatusIcon status={caseDetail.status} className="w-3.5 h-3.5" />
                  {STATUS_META[caseDetail.status].label}
                </span>
              )}
              {currentUserRole === 'admin' && (
                <button
                  type="button"
                  onClick={deleteCase}
                  data-intent="case_delete"
                  disabled={deleting}
                  title="Permanently delete this case and all its files"
                  className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 transition disabled:opacity-60"
                >
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 6h12M8.5 6V4.5h3V6m-6 0 .6 9a1 1 0 0 0 1 .9h4.8a1 1 0 0 0 1-.9l.6-9" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              )}
              {/* Escalate-to-video hook (feature #3 — not wired yet) */}
              <button
                type="button"
                disabled
                data-intent="call_start"
                title="Live video call — coming soon"
                className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-slate-200 text-slate-400 cursor-not-allowed"
              >
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="2.5" y="6" width="10" height="8" rx="2" /><path d="M12.5 9l5-2.5v7l-5-2.5" strokeLinejoin="round" /></svg>
                Call
              </button>
            </div>
          </div>
        </div>

        {/* Auto-generated 3D previews (optimized GLBs from the incoming scan) */}
        {glbPreviews.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-primary" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M10 2.5 3 6v8l7 3.5 7-3.5V6l-7-3.5z" strokeLinejoin="round" /><path d="M3 6l7 3.5L17 6M10 9.5v8" strokeLinejoin="round" /></svg>
              <h2 className="text-sm font-semibold text-slate-700">3D preview{glbPreviews.length > 1 ? `s (${glbPreviews.length})` : ''}</h2>
              <span className="text-xs text-slate-400">auto-generated · click the model to drop a pin</span>
            </div>
            <div className="grid grid-cols-1 gap-5">
              {glbPreviews.map(p => (
                <div key={p.id} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
                  <div className="relative h-64 sm:h-72">
                    <ViewportCanvas placeholder={<div className="flex h-full w-full items-center justify-center text-sm text-slate-400">3D preview · scroll to load</div>}>
                    <ScanViewer
                      url={p.url}
                      gateTouch
                      className="h-full w-full"
                      viewKey={`${caseId}:glb:${p.id}`}
                      annotations={annotations.filter(an => an.previewKey === p.id)}
                      onCreateAnnotation={pt => createPreviewAnnotation(p.id, pt)}
                      onDeleteAnnotation={deleteAnnotation}
                      onLoad={source => track('scan_view', { caseId, ext: 'glb', size: p.size, source })}
                      onError={detail => reportClientError('scan_viewer', caseId, detail, { ext: 'glb', size: p.size })}
                    />
                    </ViewportCanvas>
                    <button
                      type="button"
                      data-intent="viewer_maximize"
                      data-intent-meta="glb_preview"
                      onClick={() => setMaximizedPreview(p)}
                      title="Expand to full window"
                      aria-label="Expand to full window"
                      className="absolute right-2 top-2 rounded-lg bg-black/40 p-1.5 text-white/90 opacity-80 backdrop-blur-sm transition hover:bg-black/60 hover:opacity-100"
                    >
                      <IconMaximize />
                    </button>
                  </div>
                  <div className="flex items-center justify-between bg-slate-800 px-3 py-1.5 text-xs text-slate-300">
                    <span className="truncate">{displayName(p.name)}</span>
                    <span className="text-slate-400">{formatSize(p.size)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Thread */}
        <div className="space-y-5 mb-6">
          {messages.length === 0 && (
            <p className="text-slate-400 text-sm text-center py-8">
              No messages yet. Start the conversation below.
            </p>
          )}
          {messages.map(m => {
            const mine = m.authorId === currentUserId
            return (
              <div key={m.id} className={`flex gap-3 ${mine ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold ${ROLE_AVATAR[m.authorRole]}`} aria-hidden="true">
                  {initials(m.authorName)}
                </div>
                <div className={`max-w-[80%] rounded-2xl p-4 ${mine ? 'bg-primary/10 border border-primary/20' : 'bg-white border border-slate-200 shadow-sm'}`}>
                  <div className="flex items-baseline gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-semibold text-slate-800">{m.authorName}</span>
                    <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full ring-1 ring-inset ${ROLE_CHIP[m.authorRole]}`}>
                      {ROLE_LABELS[m.authorRole]}
                    </span>
                    <span className="text-xs text-slate-400">{formatTime(m.createdAt)}</span>
                  </div>
                  {m.body && <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{m.body}</p>}
                  {m.attachments.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {m.attachments.map(a => (
                        a.mimeType.startsWith('image/') ? (
                          <button
                            key={a.id}
                            type="button"
                            data-intent="image_open"
                            onClick={() => {
                              const imgs = m.attachments.filter(x => x.mimeType.startsWith('image/'))
                              setLightbox({ items: imgs, index: imgs.findIndex(x => x.id === a.id) })
                            }}
                            title={`${a.name} (${formatSize(a.size)})`}
                            className="block"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={a.dataUrl}
                              alt={a.name}
                              className="max-h-44 rounded-xl border border-slate-200 cursor-zoom-in hover:opacity-95 transition-opacity"
                            />
                          </button>
                        ) : isModelFile(a.name) ? (
                          <div key={a.id} className="basis-full">
                            <div className="group relative h-64 sm:h-72 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
                              <ViewportCanvas placeholder={<div className="flex h-full w-full items-center justify-center text-sm text-slate-400">3D scan · scroll to load</div>}>
                              <ScanViewer
                                url={a.dataUrl}
                                gateTouch
                                className="h-full w-full"
                                viewKey={`${caseId}:${a.id}`}
                                annotations={annotations.filter(an => an.attachmentId === a.id)}
                                onCreateAnnotation={p => createAnnotation(a.id, p)}
                                onDeleteAnnotation={deleteAnnotation}
                                onLoad={source => track('scan_view', { caseId, ext: a.name.split('.').pop()?.toLowerCase(), size: a.size, source })}
                                onError={detail => reportClientError('scan_viewer', caseId, detail, { ext: a.name.split('.').pop()?.toLowerCase(), size: a.size })}
                              />
                              </ViewportCanvas>
                              <button
                                type="button"
                                data-intent="viewer_maximize"
                                data-intent-meta="model"
                                onClick={() => setMaximized(a)}
                                title="Expand to full window"
                                aria-label="Expand to full window"
                                className="absolute right-2 top-2 rounded-lg bg-black/40 p-1.5 text-white/90 opacity-80 backdrop-blur-sm transition hover:bg-black/60 hover:opacity-100"
                              >
                                <IconMaximize />
                              </button>
                            </div>
                            <a
                              href={a.dataUrl}
                              download={a.name}
                              data-intent="attachment_download"
                              data-intent-meta="model"
                              className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-primary"
                            >
                              {displayName(a.name)} <span className="text-slate-400">({formatSize(a.size)})</span>
                            </a>
                          </div>
                        ) : isHtmlViewer(a.name) ? (
                          <div key={a.id} className="basis-full">
                            <div className="group relative h-96 w-full overflow-hidden rounded-xl border border-slate-200 bg-white">
                              <HtmlViewer
                                dataUrl={a.dataUrl}
                                className="h-full w-full border-0"
                                onLoad={() => track('html_view', { caseId, ext: a.name.split('.').pop()?.toLowerCase(), size: a.size })}
                                onError={detail => reportClientError('html_viewer', caseId, detail, { ext: a.name.split('.').pop()?.toLowerCase(), size: a.size })}
                              />
                              <button
                                type="button"
                                data-intent="viewer_maximize"
                                data-intent-meta="html"
                                onClick={() => setMaximized(a)}
                                title="Expand to full window"
                                aria-label="Expand to full window"
                                className="absolute right-2 top-2 rounded-lg bg-slate-900/50 p-1.5 text-white opacity-80 backdrop-blur-sm transition hover:bg-slate-900/70 hover:opacity-100"
                              >
                                <IconMaximize />
                              </button>
                            </div>
                            <a
                              href={a.dataUrl}
                              download={a.name}
                              data-intent="attachment_download"
                              data-intent-meta="html"
                              className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-primary"
                            >
                              {displayName(a.name)} <span className="text-slate-400">({formatSize(a.size)}) · treatment-plan viewer</span>
                            </a>
                          </div>
                        ) : (
                          <a
                            key={a.id}
                            href={a.dataUrl}
                            download={a.name}
                            data-intent="attachment_download"
                            data-intent-meta="file"
                            className="text-sm text-primary hover:bg-slate-50 flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 transition-colors"
                          >
                            <svg className="w-4 h-4 text-slate-400" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M13 7l-5.5 5.5a2 2 0 0 0 2.8 2.8L16 9a3.5 3.5 0 0 0-5-5l-6 6a5 5 0 0 0 7 7l5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            {displayName(a.name)} <span className="text-slate-400">({formatSize(a.size)})</span>
                          </a>
                        )
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Typing indicator */}
        <div className="h-5 mb-2" aria-live="polite">
          {typingName && (
            <span className="inline-flex items-center gap-2 text-sm text-slate-500">
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
              </span>
              {typingName} is typing…
            </span>
          )}
        </div>

        {/* Composer */}
        <form
          onSubmit={handleSend}
          onDragOver={onDragOverFiles}
          onDragLeave={onDragLeaveFiles}
          onDrop={onDropFiles}
          onPaste={onPasteFiles}
          className={`bg-white rounded-2xl border shadow-sm p-4 transition-colors ${
            dragActive ? 'border-primary ring-2 ring-primary/40 bg-primary/5' : 'border-slate-200'
          }`}
        >
          <div
            role="alert"
            aria-live="polite"
            className={sendError ? 'mb-2 p-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm' : 'sr-only'}
          >
            {sendError || ''}
          </div>
          <textarea
            value={body}
            onChange={e => { setBody(e.target.value); notifyTyping() }}
            onFocus={() => track('composer_focus', { caseId })}
            rows={3}
            maxLength={5000}
            placeholder="Write a message… (attach, drag & drop, or paste photos, screenshots, scan files)"
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-y text-slate-800"
          />

          {pending.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {pending.map((p, i) => (
                <span key={i} className="inline-flex items-center gap-2 text-sm bg-slate-100 text-slate-700 rounded-lg px-3 py-1.5">
                  <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M13 7l-5.5 5.5a2 2 0 0 0 2.8 2.8L16 9a3.5 3.5 0 0 0-5-5l-6 6a5 5 0 0 0 7 7l5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  {p.name} <span className="text-slate-400">({formatSize(p.size)})</span>
                  <button type="button" onClick={() => removePending(i)} data-intent="attach_remove" aria-label={`Remove ${p.name}`} className="text-slate-400 hover:text-red-600">✕</button>
                </span>
              ))}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <label data-intent="attach_files" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-primary cursor-pointer transition-colors">
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M13 7l-5.5 5.5a2 2 0 0 0 2.8 2.8L16 9a3.5 3.5 0 0 0-5-5l-6 6a5 5 0 0 0 7 7l5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                Attach files
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={e => handleFiles(e.target.files)}
                  className="sr-only"
                />
              </label>
              {currentUserRole === 'doctor' && (
                hasApproved ? (
                  <span
                    className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700"
                    title="You've approved this design"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 10.5l3.5 3.5L16 5.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    Design approved
                  </span>
                ) : (
                  <button
                    type="button"
                    data-intent="design_approve"
                    onClick={handleApprove}
                    disabled={approving || sending}
                    title="Approve the design — a quick sign-off; does not delay shipping"
                    className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 10.5l3.5 3.5L16 5.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    {approving ? 'Approving…' : 'Approve design'}
                  </button>
                )
              )}
            </div>
            <button
              type="submit"
              data-intent="message_send"
              disabled={sending || (!body.trim() && pending.length === 0)}
              className="bg-primary text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-primary/90 shadow-sm transition disabled:opacity-50"
            >
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </form>
        {maximized && typeof document !== 'undefined' && createPortal(
          <>
            <div className="fixed inset-0 z-[60] overflow-hidden touch-none overscroll-contain bg-slate-950">
              {isModelFile(maximized.name) ? (
                <ScanViewer
                  fullscreen
                  url={maximized.dataUrl}
                  className="h-full w-full"
                  viewKey={`${caseId}:${maximized.id}`}
                  annotations={annotations.filter(an => an.attachmentId === maximized.id)}
                  onCreateAnnotation={p => createAnnotation(maximized.id, p)}
                  onDeleteAnnotation={deleteAnnotation}
                  onLoad={source => track('scan_view', { caseId, ext: maximized.name.split('.').pop()?.toLowerCase(), size: maximized.size, maximized: true, source })}
                  onError={detail => reportClientError('scan_viewer', caseId, detail, { ext: maximized.name.split('.').pop()?.toLowerCase(), size: maximized.size, maximized: true })}
                />
              ) : (
                <HtmlViewer
                  dataUrl={maximized.dataUrl}
                  className="h-full w-full border-0 bg-white"
                  onLoad={() => track('html_view', { caseId, ext: maximized.name.split('.').pop()?.toLowerCase(), size: maximized.size, maximized: true })}
                  onError={detail => reportClientError('html_viewer', caseId, detail, { ext: maximized.name.split('.').pop()?.toLowerCase(), size: maximized.size, maximized: true })}
                />
              )}
            </div>
            {/* Chrome in a separate top compositing layer (z-70) so the WebGL canvas can't cover it on mobile */}
            <div className="pointer-events-none fixed inset-x-0 top-0 z-[70] flex touch-none items-center gap-3 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
              <button
                type="button"
                data-intent="viewer_close"
                onClick={() => setMaximized(null)}
                className="pointer-events-auto inline-flex shrink-0 touch-none items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm text-white shadow-lg transition hover:bg-white/25"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" /></svg>
                Close
              </button>
              <span className="pointer-events-none min-w-0 flex-1 truncate text-sm font-medium text-slate-100 drop-shadow">{maximized.name}</span>
            </div>
          </>,
          document.body
        )}
        {maximizedPreview && typeof document !== 'undefined' && createPortal(
          <>
            <div className="fixed inset-0 z-[60] overflow-hidden touch-none overscroll-contain bg-slate-950">
              <ScanViewer
                fullscreen
                url={maximizedPreview.url}
                className="h-full w-full"
                viewKey={`${caseId}:glb:${maximizedPreview.id}:max`}
                annotations={annotations.filter(an => an.previewKey === maximizedPreview.id)}
                onCreateAnnotation={p => createPreviewAnnotation(maximizedPreview.id, p)}
                onDeleteAnnotation={deleteAnnotation}
                onLoad={source => track('scan_view', { caseId, ext: 'glb', size: maximizedPreview.size, maximized: true, source })}
                onError={detail => reportClientError('scan_viewer', caseId, detail, { ext: 'glb', size: maximizedPreview.size, maximized: true })}
              />
            </div>
            {/* Chrome in a separate top compositing layer (z-70) so the WebGL canvas can't cover it on mobile */}
            <div className="pointer-events-none fixed inset-x-0 top-0 z-[70] flex touch-none items-center gap-3 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
              <button
                type="button"
                data-intent="viewer_close"
                onClick={() => setMaximizedPreview(null)}
                className="pointer-events-auto inline-flex shrink-0 touch-none items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm text-white shadow-lg transition hover:bg-white/25"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" /></svg>
                Close
              </button>
              <span className="pointer-events-none min-w-0 flex-1 truncate text-sm font-medium text-slate-100 drop-shadow">{displayName(maximizedPreview.name)}</span>
            </div>
          </>,
          document.body
        )}
        {lightbox && (
          <Lightbox
            items={lightbox.items}
            index={lightbox.index}
            onClose={() => setLightbox(null)}
            onNav={i => setLightbox(l => (l ? { ...l, index: i } : l))}
          />
        )}
    </div>
  )
}

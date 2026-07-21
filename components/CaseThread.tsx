'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { StatusIcon } from './StatusIcon'
import {
  STATUS_META,
  STAGES_BY_TYPE,
  CASE_TYPE_LABELS,
  type CaseStatus,
  type CaseType,
} from '@/lib/case-meta'
import { computeSla, SLA_CHIP, type SlaConfigMap } from '@/lib/sla'
import { subscribeCaseEvents } from '@/lib/portal-stream'

type Role = 'doctor' | 'planner' | 'admin'

interface Attachment {
  id: string
  name: string
  mimeType: string
  size: number
  dataUrl: string
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

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024

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
  name: string
  mimeType: string
  size: number
  dataUrl: string
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
          <a href={item.dataUrl} download={item.name} onClick={e => e.stopPropagation()} aria-label="Download" className={iconBtn}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </a>
          <button onClick={onClose} aria-label="Close" className={iconBtn}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>
          </button>
        </div>
      </div>

      {/* prev / next */}
      {index > 0 && (
        <button onClick={e => { e.stopPropagation(); onNav(index - 1) }} aria-label="Previous image" className="absolute left-3 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center">
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      )}
      {index < items.length - 1 && (
        <button onClick={e => { e.stopPropagation(); onNav(index + 1) }} aria-label="Next image" className="absolute right-3 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center">
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
        <button onClick={() => zoomBy(0.8)} aria-label="Zoom out" className="w-9 h-9 rounded-full hover:bg-white/20 flex items-center justify-center">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M8 11h6M20 20l-3.5-3.5" strokeLinecap="round" /></svg>
        </button>
        <span className="w-12 text-center text-xs tabular-nums">{Math.round(scale * 100)}%</span>
        <button onClick={() => zoomBy(1.25)} aria-label="Zoom in" className="w-9 h-9 rounded-full hover:bg-white/20 flex items-center justify-center">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M11 8v6M8 11h6M20 20l-3.5-3.5" strokeLinecap="round" /></svg>
        </button>
        <button onClick={reset} aria-label="Reset zoom" className="w-9 h-9 rounded-full hover:bg-white/20 flex items-center justify-center">
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

  // Live clock so the SLA chip recomputes on its own as time passes.
  const [now, setNow] = useState(() => new Date())
  const [slaConfig, setSlaConfig] = useState<SlaConfigMap>({})
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const [body, setBody] = useState('')
  const [pending, setPending] = useState<PendingAttachment[]>([])
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [statusSaving, setStatusSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [lightbox, setLightbox] = useState<{ items: Attachment[]; index: number } | null>(null)

  // Realtime "typing" indicator for the other participant.
  const [typingName, setTypingName] = useState<string | null>(null)
  const typingClearRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTypingSentRef = useRef(0)
  const lastReadRef = useRef(0)

  const isLab = currentUserRole === 'planner' || currentUserRole === 'admin'

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

  const fetchThread = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/portal/cases/${caseId}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to load case')
      }
      const data = await res.json()
      setCaseDetail(data.case)
      setMessages(data.messages ?? [])
      setSlaConfig(data.slaConfig ?? {})
      markRead(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this case.')
    } finally {
      setLoading(false)
    }
  }, [caseId, markRead])

  useEffect(() => { fetchThread() }, [fetchThread])

  // Lightweight refetch of just the messages (used by the live SSE stream).
  const refreshMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/portal/cases/${caseId}/messages`)
      if (!res.ok) return
      const data = await res.json()
      setMessages(data.messages ?? [])
      markRead() // we're viewing, so keep it read
    } catch {
      /* transient; the stream will prompt again on the next update */
    }
  }, [caseId, markRead])

  // Refetch this thread when the tab regains focus/visibility. A backgrounded
  // mobile tab freezes and drops the SSE stream, so on reopen the conversation
  // can be stale — pull the latest messages.
  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === 'visible') void refreshMessages()
    }
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onFocus)
      window.removeEventListener('focus', onFocus)
    }
  }, [refreshMessages])

  // Realtime updates via the single shared stream: refetch messages when this
  // case gets a new message, and show the typing indicator. One connection is
  // shared app-wide (see lib/portal-stream), so no per-case EventSource.
  useEffect(() => {
    const unsub = subscribeCaseEvents(ev => {
      if (ev.caseId !== caseId) return
      if (ev.event === 'update') {
        void refreshMessages()
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
  }, [caseId, refreshMessages, currentUserId])

  // Tell the server we're typing — throttled to at most once every 2.5s.
  const notifyTyping = useCallback(() => {
    const now = Date.now()
    if (now - lastTypingSentRef.current < 2500) return
    lastTypingSentRef.current = now
    void fetch(`/api/portal/cases/${caseId}/typing`, { method: 'POST' }).catch(() => {})
  }, [caseId])

  const handleFiles = async (files: FileList | null) => {
    if (!files) return
    setSendError('')
    const next: PendingAttachment[] = []
    for (const file of Array.from(files)) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setSendError(`"${file.name}" exceeds the 8MB limit.`)
        continue
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
      })
      next.push({ name: file.name, mimeType: file.type, size: file.size, dataUrl })
    }
    setPending(prev => [...prev, ...next])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removePending = (index: number) => {
    setPending(prev => prev.filter((_, i) => i !== index))
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!body.trim() && pending.length === 0) return
    setSending(true)
    setSendError('')
    try {
      const res = await fetch(`/api/portal/cases/${caseId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: body.trim(), attachments: pending }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessages(data.messages ?? [])
        setBody('')
        setPending([])
      } else {
        setSendError(data.error ?? 'Failed to send message.')
      }
    } catch {
      setSendError('An unexpected error occurred.')
    } finally {
      setSending(false)
    }
  }

  const handleStatusChange = async (status: CaseStatus) => {
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
      }
    } finally {
      setStatusSaving(false)
    }
  }

  // Planner/admin: start (or clear) the SLA clock by marking the scans received.
  const markScansReceived = async (received: boolean) => {
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
      }
    } finally {
      setStatusSaving(false)
    }
  }

  if (loading) {
    return (
      <p className="text-gray-500">Loading case…</p>
    )
  }

  if (error || !caseDetail) {
    return (
      <div>
        <a href="/portal" className="text-primary text-sm hover:underline">&larr; Back to cases</a>
        <div role="alert" className="mt-4 p-4 rounded-lg bg-red-50 border border-red-300 text-red-700">
          {error || 'Case not found.'}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
        <a href="/portal" className="inline-flex items-center gap-1.5 text-slate-500 text-sm hover:text-primary transition-colors">
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 5l-5 5 5 5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Back to cases
        </a>

        {/* Case header */}
        <div className="mt-4 mb-6 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-mono text-slate-400 tabular-nums">{caseDetail.caseNumber}</span>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">{caseDetail.title}</h1>
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
                <span className="text-slate-500">Dr. {caseDetail.doctorName}</span>
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
            <div className="flex items-center gap-3">
              {isLab && !caseDetail.scanReceivedAt && caseDetail.status !== 'shipped' && (
                <button
                  type="button"
                  onClick={() => markScansReceived(true)}
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
              {/* Escalate-to-video hook (feature #3 — not wired yet) */}
              <button
                type="button"
                disabled
                title="Live video call — coming soon"
                className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-slate-200 text-slate-400 cursor-not-allowed"
              >
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="2.5" y="6" width="10" height="8" rx="2" /><path d="M12.5 9l5-2.5v7l-5-2.5" strokeLinejoin="round" /></svg>
                Call
              </button>
            </div>
          </div>
        </div>

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
                        ) : (
                          <a
                            key={a.id}
                            href={a.dataUrl}
                            download={a.name}
                            className="text-sm text-primary hover:bg-slate-50 flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 transition-colors"
                          >
                            <svg className="w-4 h-4 text-slate-400" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M13 7l-5.5 5.5a2 2 0 0 0 2.8 2.8L16 9a3.5 3.5 0 0 0-5-5l-6 6a5 5 0 0 0 7 7l5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            {a.name} <span className="text-slate-400">({formatSize(a.size)})</span>
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
        <form onSubmit={handleSend} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
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
            rows={3}
            maxLength={5000}
            placeholder="Write a message… (attach photos, screenshots, or scan files)"
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-y text-slate-800"
          />

          {pending.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {pending.map((p, i) => (
                <span key={i} className="inline-flex items-center gap-2 text-sm bg-slate-100 text-slate-700 rounded-lg px-3 py-1.5">
                  <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M13 7l-5.5 5.5a2 2 0 0 0 2.8 2.8L16 9a3.5 3.5 0 0 0-5-5l-6 6a5 5 0 0 0 7 7l5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  {p.name} <span className="text-slate-400">({formatSize(p.size)})</span>
                  <button type="button" onClick={() => removePending(i)} aria-label={`Remove ${p.name}`} className="text-slate-400 hover:text-red-600">✕</button>
                </span>
              ))}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between">
            <label className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-primary cursor-pointer transition-colors">
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
            <button
              type="submit"
              disabled={sending || (!body.trim() && pending.length === 0)}
              className="bg-primary text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-primary/90 shadow-sm transition disabled:opacity-50"
            >
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </form>
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

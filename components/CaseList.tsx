'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { StatusIcon } from './StatusIcon'
import { SegmentedControl } from './SegmentedControl'
import {
  STATUS_META,
  STAGES_BY_TYPE,
  CASE_STATUSES,
  CASE_TYPE_LABELS,
  CASE_TYPE_GROUPS,
  type CaseStatus,
  type CaseType,
} from '@/lib/case-meta'
import { computeSla, SLA_CHIP, type SlaConfigMap } from '@/lib/sla'

interface CaseRow {
  id: string
  caseNumber: string
  doctorName: string
  title: string
  patientName?: string
  surgeryDate?: string
  toothRef?: string
  material?: string
  caseType: CaseType
  isRush?: boolean
  status: CaseStatus
  scanReceivedAt?: string
  createdAt: string
  updatedAt: string
  messageCount: number
  unreadCount?: number
}

const SCANNERS = [
  'iTero',
  '3Shape TRIOS',
  'Medit',
  'Dentsply Sirona',
  'Carestream',
  'Planmeca',
  'Other',
  'Physical impression',
]

const DEFAULT_ORDER: CaseStatus[] = STAGES_BY_TYPE.guide

// Full lifecycle tracker: renders every stage for the case's type, fills the
// completed ones, and highlights the current stage with a ring + emphasized label.
function StatusTracker({ status, order = DEFAULT_ORDER }: { status: CaseStatus; order?: CaseStatus[] }) {
  const idx = order.indexOf(status)
  return (
    <ol className="flex items-start w-full" aria-label={`Status: ${STATUS_META[status].label}`}>
      {order.map((st, i) => {
        const done = i < idx
        const current = i === idx
        const last = i === order.length - 1
        const meta = STATUS_META[st]
        return (
          <li key={st} className={`flex items-start ${last ? '' : 'flex-1'}`}>
            <div className="flex flex-col items-center gap-1.5">
              <span className="relative flex items-center justify-center w-7 h-7">
                {current && !last && (
                  <span
                    className={`absolute inset-0 rounded-full ${meta.soft} motion-safe:animate-ping`}
                    aria-hidden="true"
                  />
                )}
                <span
                  className={
                    current
                      ? `relative flex items-center justify-center w-7 h-7 rounded-full ${meta.soft} ${meta.icon} ring-2 ${meta.ring}`
                      : done
                      ? `relative flex items-center justify-center w-7 h-7 rounded-full ${meta.soft} ${meta.icon}`
                      : 'relative flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-400 ring-1 ring-inset ring-slate-200'
                  }
                >
                  <StatusIcon status={st} className="w-4 h-4" />
                </span>
              </span>
              <span
                className={`text-[10px] font-medium leading-none whitespace-nowrap ${
                  current ? meta.text : done ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                {meta.label}
              </span>
            </div>
            {!last && (
              <span
                className={`mt-[14px] h-0.5 flex-1 mx-1 rounded-full ${done ? meta.bar : 'bg-slate-200'}`}
                aria-hidden="true"
              />
            )}
          </li>
        )
      })}
    </ol>
  )
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

// Whole days from today to the given ISO date (negative = past).
function daysUntil(iso: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(`${iso}T00:00:00`)
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

function urgencyClass(iso: string | undefined, status: CaseStatus): string {
  if (!iso || status === 'shipped') return 'text-slate-500'
  const d = daysUntil(iso)
  if (d <= 7) return 'text-red-600'
  if (d <= 14) return 'text-amber-600'
  return 'text-slate-500'
}

// --- Inline icons (no external library) ---
function IconUser({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <circle cx="10" cy="6.5" r="3" />
      <path d="M4 16c0-3 2.7-4.5 6-4.5s6 1.5 6 4.5" strokeLinecap="round" />
    </svg>
  )
}
function IconCalendar({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <rect x="3" y="4.5" width="14" height="12" rx="2" />
      <path d="M3 8h14M7 3v3M13 3v3" strokeLinecap="round" />
    </svg>
  )
}
function IconChat({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M4 5.5h12a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 16 13.5H9l-4 3v-3H4A1.5 1.5 0 0 1 2.5 12V7A1.5 1.5 0 0 1 4 5.5Z" strokeLinejoin="round" />
    </svg>
  )
}
function IconChevron({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M8 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function CaseList() {
  const [cases, setCases] = useState<CaseRow[]>([])
  const [role, setRole] = useState<'doctor' | 'planner' | 'admin'>('doctor')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // New-case form (doctors only)
  const [showForm, setShowForm] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState('')
  const [caseType, setCaseType] = useState<CaseType>('guide')
  const [patientName, setPatientName] = useState('')
  const [surgeryDate, setSurgeryDate] = useState('')
  const [toothRef, setToothRef] = useState('')
  const [material, setMaterial] = useState('')
  const [scannerBrand, setScannerBrand] = useState('')
  const [scanCaseId, setScanCaseId] = useState('')
  const [scanLink, setScanLink] = useState('')
  const [specialInstructions, setSpecialInstructions] = useState('')
  const [isRush, setIsRush] = useState(false)
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState('')

  // When the new-case form opens, bring it into view (past the sticky toolbar)
  // and focus the first field — otherwise it can render off-screen when the
  // list is scrolled down.
  useEffect(() => {
    if (!showForm) return
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      titleInputRef.current?.focus({ preventScroll: true })
    })
  }, [showForm])

  // Ship-to address picker (doctors): options + selection (stored as snapshot text).
  const [shipAddresses, setShipAddresses] = useState<{ id: string; label?: string; address: string; isPreferred: boolean }[]>([])
  const [shipToAddress, setShipToAddress] = useState('')

  // Filter / search / sort (work queue)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | CaseStatus>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | CaseType>('all')
  const [rushOnly, setRushOnly] = useState(false)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [sortBy, setSortBy] = useState<'recent' | 'surgery'>('recent')
  // View scope: hide shipped by default; 'shipped' shows the archive, 'all' both.
  const [scope, setScope] = useState<'active' | 'shipped' | 'all'>('active')
  // Condense the sticky toolbar once the page is scrolled, to reclaim height.
  const [condensed, setCondensed] = useState(false)
  const [totalUnread, setTotalUnread] = useState(0)
  // Pagination: 20/page for doctors, 50/page for the lab work queue.
  const [page, setPage] = useState(1)

  const fetchCases = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/portal/cases')
      if (!res.ok) throw new Error('Failed to load cases')
      const data = await res.json()
      setCases(data.cases ?? [])
      setRole(data.role ?? 'doctor')
      setTotalUnread(data.totalUnread ?? 0)
      setSlaConfig(data.slaConfig ?? {})
    } catch {
      if (!silent) setError('Could not load cases. Please refresh.')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCases() }, [fetchCases])

  // Live clock so SLA chips recompute on their own as time passes (e.g. "due
  // today" rolls to "overdue" at midnight) without needing a refetch.
  const [now, setNow] = useState(() => new Date())
  const [slaConfig, setSlaConfig] = useState<SlaConfigMap>({})
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  // Refresh unread badges when a case is read/updated elsewhere (thread view).
  // Debounced + silent so bursts collapse into one background refetch (no skeleton).
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null
    const onChanged = () => {
      if (t) clearTimeout(t)
      t = setTimeout(() => { void fetchCases(true) }, 400)
    }
    window.addEventListener('cases:changed', onChanged)
    return () => {
      window.removeEventListener('cases:changed', onChanged)
      if (t) clearTimeout(t)
    }
  }, [fetchCases])

  // Collapse the sticky toolbar after a small scroll offset.
  useEffect(() => {
    const onScroll = () => setCondensed(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Refetch when the tab regains focus/visibility. A backgrounded mobile tab is
  // frozen (SSE drops), so on reopen the list can be stale — pull fresh silently.
  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === 'visible') void fetchCases(true)
    }
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onFocus)
      window.removeEventListener('focus', onFocus)
    }
  }, [fetchCases])

  // Reset to the first page whenever the filtered set's inputs change.
  useEffect(() => {
    setPage(1)
  }, [query, statusFilter, typeFilter, rushOnly, unreadOnly, scope, sortBy])

  // Load the doctor's practice addresses to populate the ship-to picker.
  useEffect(() => {
    if (role !== 'doctor') return
    let cancelled = false
    ;(async () => {
      try {
        const sres = await fetch('/api/portal/session')
        if (!sres.ok) return
        const sdata = await sres.json()
        const uid = sdata?.user?.id
        if (!uid) return
        const ares = await fetch(`/api/portal/doctors/${uid}/addresses`)
        if (!ares.ok) return
        const adata = await ares.json()
        if (cancelled) return
        const list = adata.addresses ?? []
        setShipAddresses(list)
        const preferred = list.find((a: { isPreferred: boolean }) => a.isPreferred) ?? list[0]
        if (preferred) setShipToAddress(preferred.address)
      } catch {
        /* non-fatal: form still works without a picker */
      }
    })()
    return () => { cancelled = true }
  }, [role])

  // Restore the dentist's last sort choice, then persist it on change.
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('jdlab.caseSort') : null
    if (saved === 'surgery' || saved === 'recent') setSortBy(saved)
  }, [])

  // Restore the "unread only" focus filter within the session, so replying to a
  // case and navigating back keeps the doctor filtered on remaining unread work.
  // Session-scoped (not localStorage) so it doesn't persist into a fresh visit.
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.sessionStorage.getItem('jdlab.unreadOnly') : null
    if (saved === '1') setUnreadOnly(true)
  }, [])

  const toggleUnreadOnly = () => {
    setUnreadOnly(v => {
      const next = !v
      try {
        window.sessionStorage.setItem('jdlab.unreadOnly', next ? '1' : '0')
      } catch {
        /* ignore storage errors (private mode, etc.) */
      }
      return next
    })
  }

  const chooseSort = (value: 'recent' | 'surgery') => {
    setSortBy(value)
    try {
      window.localStorage.setItem('jdlab.caseSort', value)
    } catch {
      /* ignore storage errors (private mode, etc.) */
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    setCreating(true)
    try {
      const res = await fetch('/api/portal/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          caseType,
          patientName: patientName.trim() || undefined,
          surgeryDate: surgeryDate || undefined,
          toothRef: toothRef.trim() || undefined,
          material: material.trim() || undefined,
          scannerBrand: scannerBrand.trim() || undefined,
          scanCaseId: scanCaseId.trim() || undefined,
          scanLink: scanLink.trim() || undefined,
          specialInstructions: specialInstructions.trim() || undefined,
          shipToAddress: shipToAddress.trim() || undefined,
          isRush,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setTitle('')
        setCaseType('guide')
        setPatientName('')
        setSurgeryDate('')
        setToothRef('')
        setMaterial('')
        setScannerBrand('')
        setScanCaseId('')
        setScanLink('')
        setSpecialInstructions('')
        setIsRush(false)
        setShowForm(false)
        fetchCases()
        // Tell the persistent sidebar (rendered by the layout) to refresh.
        window.dispatchEvent(new Event('cases:changed'))
      } else {
        setFormError(data.error ?? 'Failed to create case.')
      }
    } catch {
      setFormError('An unexpected error occurred.')
    } finally {
      setCreating(false)
    }
  }

  const isDoctor = role === 'doctor'
  const heading = isDoctor ? 'My Cases' : 'Work Queue'
  const subtitle = isDoctor
    ? 'Track your submitted cases and talk to the lab team.'
    : 'All cases across doctors — open one to review and reply.'
  const activeCount = cases.filter(c => c.status !== 'shipped').length
  const labelField = 'block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5'
  const inputField = 'w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition'

  // Client-side filtering/search over the fetched cases.
  const q = query.trim().toLowerCase()
  const hasFilters = q !== '' || statusFilter !== 'all' || typeFilter !== 'all' || rushOnly || unreadOnly
  const visibleCases = cases
    .filter(c =>
      scope === 'all' ? true : scope === 'shipped' ? c.status === 'shipped' : c.status !== 'shipped'
    )
    .filter(c => statusFilter === 'all' || c.status === statusFilter)
    .filter(c => typeFilter === 'all' || c.caseType === typeFilter)
    .filter(c => !rushOnly || c.isRush)
    .filter(c => !unreadOnly || (c.unreadCount ?? 0) > 0)
    .filter(
        c =>
          !q ||
          [c.patientName, c.toothRef, c.title, c.caseNumber, c.doctorName, c.material].some(v =>
            v?.toLowerCase().includes(q)
          )
      )
    .slice()
    .sort((a, b) => {
      // Shipped archive: newest surgery date first (cases without a date sink to the bottom).
      if (scope === 'shipped') {
        if (!a.surgeryDate && !b.surgeryDate) return 0
        if (!a.surgeryDate) return 1
        if (!b.surgeryDate) return -1
        return b.surgeryDate.localeCompare(a.surgeryDate)
      }
      if (sortBy === 'surgery') {
        if (!a.surgeryDate && !b.surgeryDate) return 0
        if (!a.surgeryDate) return 1
        if (!b.surgeryDate) return -1
        return a.surgeryDate.localeCompare(b.surgeryDate)
      }
      return b.updatedAt.localeCompare(a.updatedAt)
    })

  // Pagination: doctors 20/page, lab (planner/admin) 50/page.
  const pageSize = isDoctor ? 20 : 50
  const totalPages = Math.max(1, Math.ceil(visibleCases.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pagedCases = visibleCases.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const clearFilters = () => {
    setQuery('')
    setStatusFilter('all')
    setTypeFilter('all')
    setRushOnly(false)
    setUnreadOnly(false)
    try {
      window.sessionStorage.setItem('jdlab.unreadOnly', '0')
    } catch {
      /* ignore storage errors */
    }
  }

  // Toggle a case's read state from the list (flag for follow-up / clear).
  const toggleUnread = async (id: string, isUnread: boolean) => {
    // Optimistic: flip the badge locally, then reconcile via the refetch.
    setCases(prev => prev.map(c => (c.id === id ? { ...c, unreadCount: isUnread ? 0 : 1 } : c)))
    try {
      await fetch(`/api/portal/cases/${id}/read`, { method: isUnread ? 'POST' : 'DELETE' })
    } finally {
      window.dispatchEvent(new Event('cases:changed'))
    }
  }

  return (
    <div>
            {/* Sticky toolbar: title, scope/sort, and search/filters stay pinned while scrolling */}
            <div className={`sticky top-16 z-30 -mx-4 px-4 mb-6 bg-slate-50/90 backdrop-blur supports-[backdrop-filter]:bg-slate-50/75 transition-all duration-200 ${condensed ? 'py-2 shadow-sm border-b border-slate-200' : 'pt-3 pb-3'}`}>
              <div className="flex items-end justify-between gap-4 flex-wrap">
              <div>
                <h1 className={`font-bold tracking-tight text-slate-900 transition-all duration-200 ${condensed ? 'text-lg sm:text-xl' : 'text-2xl sm:text-3xl'}`}>{heading}</h1>
                <p className={`text-slate-500 mt-1 transition-all duration-200 overflow-hidden ${condensed ? 'max-h-0 opacity-0 mt-0' : 'max-h-8 opacity-100'}`}>{subtitle}</p>
                <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 transition-all duration-200 ${condensed ? 'mt-2' : 'mt-3'}`}>
                  {/* View scope: hide shipped by default, reveal on demand */}
                  <SegmentedControl
                    ariaLabel="Show cases"
                    value={scope}
                    onChange={setScope}
                    options={[
                      { value: 'active', label: 'Active' },
                      { value: 'shipped', label: 'Shipped' },
                      { value: 'all', label: 'All' },
                    ]}
                  />
                  <SegmentedControl
                    ariaLabel="Sort cases"
                    value={sortBy}
                    onChange={chooseSort}
                    options={[
                      {
                        value: 'recent',
                        label: 'Recently updated',
                        title: 'Sort by most recently updated',
                        icon: <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10" cy="10" r="7" /><path d="M10 6v4l2.5 1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>,
                      },
                      {
                        value: 'surgery',
                        label: 'Surgery date',
                        title: 'Sort by soonest surgery/due date',
                        icon: <IconCalendar className="w-3.5 h-3.5" />,
                      },
                    ]}
                  />
                  <span className="text-xs text-slate-400 tabular-nums">{activeCount} active · {cases.length} total</span>
                  {totalUnread > 0 && (
                    <button
                      type="button"
                      onClick={toggleUnreadOnly}
                      aria-pressed={unreadOnly}
                      title={unreadOnly ? 'Showing only unread — click to show all' : `Show only the ${totalUnread} case${totalUnread === 1 ? '' : 's'} with unread messages`}
                      className={`relative inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full transition ${unreadOnly ? 'bg-accent text-white ring-2 ring-accent/40' : 'bg-accent text-white animate-pulse hover:ring-2 hover:ring-accent/40'}`}
                    >
                      {!unreadOnly && (
                        <span className="absolute -inset-1 rounded-full bg-accent/50 animate-ping" aria-hidden="true" />
                      )}
                      <span className="relative inline-flex items-center gap-1">
                        <IconChat className="w-3 h-3" />
                        {totalUnread} unread
                      </span>
                    </button>
                  )}
                </div>
              </div>
              {isDoctor && (
                <button
                  onClick={() => setShowForm(v => !v)}
                  className="inline-flex items-center gap-1.5 bg-primary text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-primary/90 shadow-sm transition"
                >
                  {showForm ? 'Cancel' : (
                    <>
                      <span className="text-base leading-none">＋</span> New Case
                    </>
                  )}
                </button>
              )}
              </div>

              {/* Search / filters — pinned together with the header */}
              {!loading && !error && cases.length > 0 && (
                <div className={`flex flex-wrap items-center gap-2 transition-all duration-200 ${condensed ? 'mt-2' : 'mt-3'}`}>
                  <div className="relative flex-1 min-w-[180px]">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="9" cy="9" r="6" /><path d="m14 14 3 3" strokeLinecap="round" /></svg>
                    <input
                      type="search"
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      placeholder="Search by patient, tooth, case #…"
                      aria-label="Search cases"
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                  </div>
                  <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as 'all' | CaseStatus)} aria-label="Filter by status" className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="all">All statuses</option>
                    {CASE_STATUSES.map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                  </select>
                  <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as 'all' | CaseType)} aria-label="Filter by type" className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="all">All types</option>
                    {CASE_TYPE_GROUPS.map(g => (
                      <optgroup key={g.label} label={g.label}>
                        {g.types.map(t => <option key={t} value={t}>{CASE_TYPE_LABELS[t]}</option>)}
                      </optgroup>
                    ))}
                  </select>
                  <label className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm text-slate-700 cursor-pointer select-none">
                    <input type="checkbox" checked={rushOnly} onChange={e => setRushOnly(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500/40" />
                    Rush only
                  </label>
                  {hasFilters && (
                    <button type="button" onClick={clearFilters} className="px-3 py-2 text-sm text-slate-500 hover:text-primary">Clear</button>
                  )}
                  <span className="text-xs text-slate-400 tabular-nums ml-auto">{visibleCases.length} of {cases.length}</span>
                </div>
              )}
            </div>

            {/* New case form */}
            {isDoctor && showForm && (
              <form
                onSubmit={handleCreate}
                ref={formRef}
                className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6 scroll-mt-32"
                noValidate
              >
                <div
                  role="alert"
                  aria-live="polite"
                  className={formError ? 'mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm' : 'sr-only'}
                >
                  {formError || ''}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label htmlFor="case-title" className={labelField}>Case Title</label>
                    <input id="case-title" ref={titleInputRef} type="text" value={title} onChange={e => setTitle(e.target.value)} required maxLength={200} placeholder="e.g. Crown #14" className={inputField} />
                  </div>
                  <div>
                    <label htmlFor="case-type" className={labelField}>Case Type</label>
                    <select id="case-type" value={caseType} onChange={e => setCaseType(e.target.value as CaseType)} className={inputField}>
                      {CASE_TYPE_GROUPS.map(g => (
                        <optgroup key={g.label} label={g.label}>
                          {g.types.map(t => <option key={t} value={t}>{CASE_TYPE_LABELS[t]}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="case-patient" className={labelField}>Patient Name</label>
                    <input id="case-patient" type="text" value={patientName} onChange={e => setPatientName(e.target.value)} maxLength={200} placeholder="Jane Doe" className={inputField} />
                  </div>
                  <div>
                    <label htmlFor="case-surgery" className={labelField}>Target Surgery Date</label>
                    <input id="case-surgery" type="date" value={surgeryDate} onChange={e => setSurgeryDate(e.target.value)} className={inputField} />
                  </div>
                  <div>
                    <label htmlFor="case-tooth" className={labelField}>Tooth / Ref</label>
                    <input id="case-tooth" type="text" value={toothRef} onChange={e => setToothRef(e.target.value)} maxLength={50} placeholder="#14" className={inputField} />
                  </div>
                  <div>
                    <label htmlFor="case-material" className={labelField}>Material</label>
                    <input id="case-material" type="text" value={material} onChange={e => setMaterial(e.target.value)} maxLength={100} placeholder="Zirconia" className={inputField} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
                      <input type="checkbox" checked={isRush} onChange={e => setIsRush(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500/40" />
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700">
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-red-600 text-white">
                          <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13z" /></svg>
                          Rush
                        </span>
                        Mark as a rush case (expedited turnaround)
                      </span>
                    </label>
                  </div>
                  <div className="md:col-span-2 pt-3 mt-1 border-t border-slate-100">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Scan source</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Where the lab pulls the STL from — e.g. the iTero portal order ID</p>
                  </div>
                  <div>
                    <label htmlFor="case-scanner" className={labelField}>Scanner</label>
                    <select id="case-scanner" value={scannerBrand} onChange={e => setScannerBrand(e.target.value)} className={inputField}>
                      <option value="">Select…</option>
                      {SCANNERS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="case-scanid" className={labelField}>Portal Case / Order ID</label>
                    <input id="case-scanid" type="text" value={scanCaseId} onChange={e => setScanCaseId(e.target.value)} maxLength={100} placeholder="ITL-88421" className={inputField} />
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor="case-scanlink" className={labelField}>Portal Link <span className="text-slate-400 font-normal normal-case">(optional)</span></label>
                    <input id="case-scanlink" type="url" value={scanLink} onChange={e => setScanLink(e.target.value)} maxLength={500} placeholder="https://myitero.com/…" className={inputField} />
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor="case-shipto" className={labelField}>Ship-to Address</label>
                    {shipAddresses.length > 0 ? (
                      <select id="case-shipto" value={shipToAddress} onChange={e => setShipToAddress(e.target.value)} className={inputField}>
                        {shipAddresses.map(a => (
                          <option key={a.id} value={a.address}>
                            {(a.label ? `${a.label} — ` : '') + a.address}{a.isPreferred ? ' (preferred)' : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input id="case-shipto" type="text" value={shipToAddress} onChange={e => setShipToAddress(e.target.value)} maxLength={400} placeholder="Where should we ship this case?" className={inputField} />
                    )}
                    <p className="text-xs text-slate-400 mt-1">
                      Manage your saved addresses in <a href="/portal/profile" className="text-primary hover:underline">your profile</a>.
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor="case-instructions" className={labelField}>Special Instructions <span className="text-slate-400 font-normal normal-case">(optional)</span></label>
                    <textarea id="case-instructions" value={specialInstructions} onChange={e => setSpecialInstructions(e.target.value)} maxLength={2000} rows={3} placeholder="e.g. Deliver by Mon 8am (surgery time) · Adult signature required · Light occlusal contacts · Color the MUA notches" className={`${inputField} resize-y`} />
                  </div>
                </div>
                <div className="mt-5 flex justify-end">
                  <button type="submit" disabled={creating} className="bg-primary text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-primary/90 shadow-sm transition disabled:opacity-60">
                    {creating ? 'Creating…' : 'Create Case'}
                  </button>
                </div>
              </form>
            )}

            {/* Case list */}
            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2].map(i => (
                  <div key={i} className="h-20 rounded-2xl border border-slate-200 bg-white animate-pulse" />
                ))}
              </div>
            ) : error ? (
              <div role="alert" className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            ) : cases.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
                <p className="text-slate-500">
                  {isDoctor
                    ? 'No cases yet. Create your first case to start a conversation with the lab team.'
                    : 'No cases in the queue yet.'}
                </p>
              </div>
            ) : visibleCases.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
                <p className="text-slate-500">No cases match your filters.</p>
                <button type="button" onClick={clearFilters} className="mt-2 text-sm text-primary hover:underline">Clear filters</button>
              </div>
            ) : (
                  <ul className="space-y-4">
                    {pagedCases.map(c => {
                  const s = STATUS_META[c.status]
                  return (
                    <li key={c.id}>
                      <Link
                        href={`/portal/cases/${c.id}`}
                        className="group relative block bg-white rounded-2xl border border-slate-200 hover:border-primary/40 hover:shadow-md shadow-sm transition-all pl-5 pr-4 py-4 overflow-hidden"
                      >
                        {/* status accent bar */}
                        <span className={`absolute left-0 top-0 bottom-0 w-1 ${s.bar}`} aria-hidden="true" />

                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-5">
                          {/* identity */}
                          <div className="min-w-0 lg:flex-1">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <span className="text-xs font-mono text-slate-400 tabular-nums">{c.caseNumber}</span>
                              <span className="font-semibold text-slate-900 truncate">{c.title}</span>
                              <span className="text-xs font-medium text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">{CASE_TYPE_LABELS[c.caseType]}</span>
                              {c.isRush && c.status !== 'shipped' && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-red-600 text-white" title="Rush case">
                                  <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13z" /></svg>
                                  Rush
                                </span>
                              )}
                              {c.material && (
                                <span className="text-xs text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">{c.material}</span>
                              )}
                            </div>
                            <div className="mt-1.5 flex items-center gap-4 flex-wrap text-sm text-slate-500">
                              {c.patientName && (
                                <span className="inline-flex items-center gap-1.5">
                                  <IconUser className="w-4 h-4 text-slate-400" /> {c.patientName}
                                </span>
                              )}
                              {c.surgeryDate && (
                                <span className={`inline-flex items-center gap-1.5 font-medium ${urgencyClass(c.surgeryDate, c.status)}`}>
                                  <IconCalendar className="w-4 h-4" /> {formatDate(c.surgeryDate)}
                                </span>
                              )}
                              {(() => {
                                const sla = computeSla(c, now, slaConfig)
                                if (sla.state === 'shipped') return null
                                return (
                                  <span
                                    className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ring-1 ring-inset ${SLA_CHIP[sla.state]}`}
                                    title={sla.dueDate ? `Due ${new Date(sla.dueDate).toLocaleDateString()}` : 'Awaiting scan files from the doctor'}
                                  >
                                    {sla.label}
                                  </span>
                                )
                              })()}
                              {!isDoctor && (
                                <span className="text-slate-500">Dr. {c.doctorName}</span>
                              )}
                              <span className="inline-flex items-center gap-1.5 text-slate-400 tabular-nums">
                                <IconChat className="w-4 h-4" /> {c.messageCount}
                              </span>
                              {(c.unreadCount ?? 0) > 0 && (
                                <span className="relative inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-accent text-white text-[11px] font-semibold tabular-nums animate-pulse" title={`${c.unreadCount} new message${c.unreadCount === 1 ? '' : 's'}`}>
                                  <span className="absolute -inset-1 rounded-full bg-accent/50 animate-ping" aria-hidden="true" />
                                  <span className="relative">{c.unreadCount}</span>
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={e => { e.preventDefault(); e.stopPropagation(); void toggleUnread(c.id, (c.unreadCount ?? 0) > 0) }}
                                className="text-xs text-slate-400 hover:text-primary underline decoration-dotted underline-offset-2 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                                aria-label={(c.unreadCount ?? 0) > 0 ? 'Mark as read' : 'Mark as unread'}
                              >
                                {(c.unreadCount ?? 0) > 0 ? 'Mark read' : 'Mark unread'}
                              </button>
                            </div>
                          </div>

                          {/* lifecycle tracker — beside the title on lg, stacked below on mobile/tablet */}
                          <div className="w-full lg:w-[23rem] xl:w-[26rem] flex-shrink-0 border-t border-slate-100 pt-3 lg:border-t-0 lg:pt-0 lg:border-l lg:border-slate-100 lg:pl-5">
                            <StatusTracker status={c.status} order={STAGES_BY_TYPE[c.caseType] ?? DEFAULT_ORDER} />
                          </div>

                          <IconChevron className="hidden lg:block w-4 h-4 text-slate-300 group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                        </div>
                      </Link>
                    </li>
                  )
                })}
                  </ul>
                )}

            {/* Pagination */}
            {!loading && !error && visibleCases.length > pageSize && (
              <nav className="mt-6 flex items-center justify-between gap-4 flex-wrap" aria-label="Case list pagination">
                <span className="text-xs text-slate-500 tabular-nums">
                  Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, visibleCases.length)} of {visibleCases.length}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => { setPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                    disabled={currentPage <= 1}
                    className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="px-2 text-sm text-slate-500 tabular-nums">Page {currentPage} of {totalPages}</span>
                  <button
                    type="button"
                    onClick={() => { setPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                    disabled={currentPage >= totalPages}
                    className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </nav>
            )}
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { track } from '@/lib/telemetry'
import { StatusIcon } from './StatusIcon'
import { SegmentedControl } from './SegmentedControl'
import {
  STATUS_META,
  STAGES_BY_TYPE,
  CASE_TYPE_LABELS,
  CASE_TYPE_GROUPS,
  formatDoctorName,
  type CaseStatus,
  type CaseType,
} from '@/lib/case-meta'
import { computeSla, SLA_CHIP, computeSurgeryReadiness, READINESS_CHIP, type SlaConfigMap } from '@/lib/sla'

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

// Back-navigation memory. On mobile, opening a case unmounts this list (the
// route-based single pane in CasesShell) and remounts it with a fresh fetch on
// back-nav, so filters, pagination and scroll would otherwise reset to defaults
// and you'd land in the wrong place (typically the bottom of the regrown list).
// We snapshot the view to sessionStorage when a case is opened and rehydrate it
// on mount. Desktop keeps the list mounted, so scroll is only reapplied on small
// viewports; the snapshot is session-scoped so it doesn't leak into a new tab.
const LIST_STATE_KEY = 'jdlab.caseListView'

type Scope = 'active' | 'shipped' | 'all'
type SortBy = 'recent' | 'surgery'

interface ListView {
  q: string
  rush: boolean
  unread: boolean
  scope: Scope
  sort: SortBy
  page: number
  y: number
}

function readListView(): ListView {
  const v: ListView = { q: '', rush: false, unread: false, scope: 'active', sort: 'recent', page: 1, y: 0 }
  if (typeof window === 'undefined') return v
  // Legacy per-key memory (predates the consolidated snapshot); used as the
  // baseline so cross-visit sort and within-session unread focus still work.
  const legacySort = window.localStorage.getItem('jdlab.caseSort')
  if (legacySort === 'surgery' || legacySort === 'recent') v.sort = legacySort
  if (window.sessionStorage.getItem('jdlab.unreadOnly') === '1') { v.unread = true; v.scope = 'all' }
  try {
    const raw = window.sessionStorage.getItem(LIST_STATE_KEY)
    if (!raw) return v
    const s = JSON.parse(raw) as Partial<ListView>
    if (typeof s.q === 'string') v.q = s.q
    v.rush = !!s.rush
    v.unread = !!s.unread
    if (s.scope === 'active' || s.scope === 'shipped' || s.scope === 'all') v.scope = s.scope
    if (s.sort === 'recent' || s.sort === 'surgery') v.sort = s.sort
    if (typeof s.page === 'number' && s.page >= 1) v.page = s.page
    if (typeof s.y === 'number' && s.y >= 0) v.y = s.y
  } catch {
    /* corrupt snapshot → fall back to defaults/legacy */
  }
  return v
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
function IconCheck({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <path d="m5 10.5 3.5 3.5L15 6" strokeLinecap="round" strokeLinejoin="round" />
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

  // Currently open case (drives the active-row highlight in the master-detail view).
  const pathname = usePathname()
  const router = useRouter()
  const activeCaseId = pathname?.startsWith('/portal/cases/') ? pathname.split('/').pop() ?? null : null

  // Keyboard niceties: '/' focuses search; j/k move the highlighted row; Enter opens it.
  const searchRef = useRef<HTMLInputElement>(null)
  const [focusIdx, setFocusIdx] = useState(-1)

  // Filter / search / sort (work queue)
  const [query, setQuery] = useState('')
  const [rushOnly, setRushOnly] = useState(false)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [sortBy, setSortBy] = useState<'recent' | 'surgery'>('recent')
  // View scope: hide shipped by default; 'shipped' shows the archive, 'all' both.
  const [scope, setScope] = useState<'active' | 'shipped' | 'all'>('active')
  // Scope to return to when the "unread only" focus filter is switched off.
  // Set when unread-only turns ON (it forces scope to 'all' so unread cases in
  // shipped/other statuses surface). Cleared if the user manually changes scope
  // while unread-only is on, so unclicking won't override their explicit choice.
  const prevScopeRef = useRef<'active' | 'shipped' | 'all' | null>(null)
  // Condense the sticky toolbar once the page is scrolled, to reclaim height.
  const [condensed, setCondensed] = useState(false)
  const [totalUnread, setTotalUnread] = useState(0)
  // SLA config drives the turnaround chips; loaded alongside the case list.
  // Declared here (before fetchCases) so its setter exists where it's used.
  const [slaConfig, setSlaConfig] = useState<SlaConfigMap>({})
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

  // Snapshot the current view (filters + page + scroll) when a case is opened,
  // so mobile back-navigation — which unmounts and remounts this list — can
  // return to the exact spot. Rehydrated by readListView() on mount.
  const rememberListState = useCallback(() => {
    const onMobile = window.matchMedia('(max-width: 1023px)').matches
    try {
      window.sessionStorage.setItem(
        LIST_STATE_KEY,
        JSON.stringify({
          q: query, rush: rushOnly, unread: unreadOnly, scope, sort: sortBy,
          page, y: onMobile ? window.scrollY : 0,
        }),
      )
    } catch {
      /* ignore storage errors (private mode, quota) */
    }
  }, [query, rushOnly, unreadOnly, scope, sortBy, page])

  // Scroll target captured during hydration (see the hydrate effect below).
  const pendingScrollRef = useRef(0)
  const scrollRestoredRef = useRef(false)
  // Reapply the saved scroll once the list has re-rendered with data (loading
  // flips false), at most once per mount so live SSE refetches — which keep
  // loading false — never yank the viewport. Mobile only.
  useEffect(() => {
    if (loading || scrollRestoredRef.current) return
    scrollRestoredRef.current = true
    const y = pendingScrollRef.current
    if (y > 0 && window.matchMedia('(max-width: 1023px)').matches) window.scrollTo(0, y)
  }, [loading])

  // Live clock so SLA chips recompute on their own as time passes (e.g. "due
  // today" rolls to "overdue" at midnight) without needing a refetch.
  const [now, setNow] = useState(() => new Date())
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

  // Rehydrate the saved view once on mount. Done in an effect (not lazy state)
  // so SSR and the first client render both use defaults → no hydration
  // mismatch; the list shows its skeleton until data + filters settle.
  const [restorePage, setRestorePage] = useState<number | null>(null)
  useEffect(() => {
    const v = readListView()
    setQuery(v.q)
    setRushOnly(v.rush)
    setUnreadOnly(v.unread)
    setScope(v.scope)
    setSortBy(v.sort)
    pendingScrollRef.current = v.y
    // Restore the page via state so phase 2 (below) can win the race against the
    // filter-driven page reset that runs in the same commit.
    setRestorePage(v.page)
  }, [])

  // Reset to the first page whenever the filtered set's inputs change.
  useEffect(() => {
    setPage(1)
  }, [query, rushOnly, unreadOnly, scope, sortBy])

  // Reapply the saved page. Declared AFTER the reset effect and keyed on a value
  // that changes in the same commit as the restored filters, so its setPage runs
  // last and survives. No-op on normal filter changes (restorePage stays null).
  useEffect(() => {
    if (restorePage == null) return
    setPage(restorePage)
    setRestorePage(null)
  }, [restorePage])

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

  // "Unread only" is a focus mode: turning it ON widens scope to 'all' so unread
  // messages in shipped/other cases aren't hidden (the badge counts them), and
  // turning it OFF restores the scope you were on before (default 'active').
  const toggleUnreadOnly = () => {
    setUnreadOnly(v => {
      const next = !v
      track('filter_unread', { on: next })
      if (next) {
        prevScopeRef.current = scope
        setScope('all')
      } else {
        setScope(prevScopeRef.current ?? 'active')
        prevScopeRef.current = null
      }
      try {
        window.sessionStorage.setItem('jdlab.unreadOnly', next ? '1' : '0')
      } catch {
        /* ignore storage errors (private mode, etc.) */
      }
      return next
    })
  }

  // Scope changes made directly by the user take precedence: forget the
  // remembered baseline so turning unread-only off later won't override it.
  const chooseScope = (value: 'active' | 'shipped' | 'all') => {
    track('scope_change', { scope: value })
    prevScopeRef.current = null
    setScope(value)
  }

  const chooseSort = (value: 'recent' | 'surgery') => {
    track('sort_change', { sort: value })
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
  const labelField = 'block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5'
  const inputField = 'w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition'

  // Client-side filtering/search over the fetched cases.
  const q = query.trim().toLowerCase()
  const hasFilters = q !== '' || rushOnly || unreadOnly

  // Human-readable summary of the current view/selection, shown in the header so
  // it's always clear which scope + filters are applied.
  // Effective sort: the shipped archive is always ordered by surgery date.
  const sortLabel = scope === 'shipped' || sortBy === 'surgery' ? 'Surgery date' : 'Recently updated'
  const appliedFilters: string[] = []
  if (rushOnly) appliedFilters.push('Rush')
  if (unreadOnly) appliedFilters.push('Unread')
  if (q) appliedFilters.push(`"${query.trim()}"`)
  const visibleCases = cases
    .filter(c =>
      scope === 'all' ? true : scope === 'shipped' ? c.status === 'shipped' : c.status !== 'shipped'
    )
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

  // Global keyboard shortcuts for the list. '/' jumps to search from anywhere;
  // j/k walk the highlighted row and Enter opens it (Gmail-style). Arrow keys are
  // intentionally left alone so they still scroll the page/thread.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
      if (e.key === '/' && !typing) {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
        return
      }
      if (typing) {
        if (e.key === 'Escape' && el === searchRef.current) el.blur()
        return
      }
      if (e.key === 'Escape') { setFocusIdx(-1); return }
      if (!pagedCases.length) return
      if (e.key === 'j') {
        e.preventDefault()
        setFocusIdx(i => Math.min((i < 0 ? -1 : i) + 1, pagedCases.length - 1))
      } else if (e.key === 'k') {
        e.preventDefault()
        setFocusIdx(i => Math.max((i <= 0 ? 1 : i) - 1, 0))
      } else if (e.key === 'Enter' && focusIdx >= 0 && focusIdx < pagedCases.length) {
        e.preventDefault()
        track('case_open', { caseId: pagedCases[focusIdx].id, from: 'keyboard' })
        router.push(`/portal/cases/${pagedCases[focusIdx].id}`)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pagedCases, focusIdx, router])

  // Keep the highlighted row valid + in view as the list changes.
  useEffect(() => {
    setFocusIdx(i => (i >= pagedCases.length ? pagedCases.length - 1 : i))
  }, [pagedCases.length])
  useEffect(() => {
    if (focusIdx < 0) return
    document.getElementById(`case-row-${focusIdx}`)?.scrollIntoView({ block: 'nearest' })
  }, [focusIdx])

  // Telemetry: record searches (length only — never the term, which may be a
  // patient name) once the user pauses typing.
  useEffect(() => {
    const q = query.trim()
    if (!q) return
    const id = setTimeout(() => track('search', { len: q.length }), 800)
    return () => clearTimeout(id)
  }, [query])

  const clearFilters = () => {
    setQuery('')
    setRushOnly(false)
    // If unread-only had widened the scope, fall back to where we were before.
    if (unreadOnly) {
      setScope(prevScopeRef.current ?? 'active')
      prevScopeRef.current = null
    }
    setUnreadOnly(false)
    try {
      window.sessionStorage.setItem('jdlab.unreadOnly', '0')
      // Also drop the consolidated view snapshot, otherwise a full refresh
      // (e.g. mobile pull-to-refresh) rehydrates the just-cleared filters.
      window.sessionStorage.removeItem(LIST_STATE_KEY)
    } catch {
      /* ignore storage errors */
    }
  }

  return (
    <div>
            {/* Sticky toolbar: title, scope/sort, and search/filters stay pinned while scrolling */}
            <div className={`sticky top-16 lg:top-0 z-30 -mx-4 px-4 mb-3 bg-slate-50/90 backdrop-blur supports-[backdrop-filter]:bg-slate-50/75 transition-all duration-200 ${condensed ? 'py-2 shadow-sm border-b border-slate-200' : 'pt-0 pb-2'}`}>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                {/* Kept for accessibility + document outline (role context:
                    "My Cases" vs "Work Queue"); the visible label below mirrors it. */}
                <h1 className="sr-only">{heading}</h1>
                <p className="sr-only">{subtitle}</p>
                {/* Low-key context label — same row as the New Case action */}
                <span className="text-xs tabular-nums" aria-hidden="true">
                  <span className="font-medium text-slate-500">{heading}</span>
                  {!loading && !error && cases.length > 0 && (
                    <span className="text-slate-400"> · {visibleCases.length} of {cases.length}{appliedFilters.length > 0 ? <> · {appliedFilters.join(' · ')}</> : ''} · <span className="text-slate-500">by {sortLabel}</span></span>
                  )}
                </span>
                {isDoctor && (
                  <button
                    onClick={() => { setShowForm(v => !v); track('new_case_toggle', { open: !showForm }) }}
                    className="inline-flex items-center gap-1 bg-primary text-white text-xs font-medium px-2.5 py-1 rounded-md hover:bg-primary/90 shadow-sm transition"
                  >
                    {showForm ? 'Cancel' : (
                      <>
                        <span className="text-sm leading-none">＋</span> New Case
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Unified control bar: search · filters · view · count (one row, wraps gracefully) */}
              {!loading && !error && cases.length > 0 && (
                <div className={`flex flex-col gap-2 transition-all duration-200 ${condensed ? 'mt-1.5' : 'mt-1'}`}>
                  {/* Row 1: search + filter pills — always one line on every screen size.
                      The search input is the shrinkable element that absorbs the width. */}
                  <div className="flex flex-nowrap items-center gap-2 w-full min-w-0">
                  {/* Search — shrinks to make room so the pills stay on the same line */}
                  <div className="relative flex-1 min-w-0">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="9" cy="9" r="6" /><path d="m14 14 3 3" strokeLinecap="round" /></svg>
                    <input
                      ref={searchRef}
                      type="search"
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      placeholder="Search by patient, tooth, case #…"
                      aria-label="Search cases"
                      aria-keyshortcuts="/"
                      className="w-full pl-9 pr-8 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                    {!query && (
                      <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden sm:flex h-5 min-w-[1.25rem] items-center justify-center rounded border border-slate-200 bg-slate-50 px-1 text-[11px] font-medium text-slate-400">/</kbd>
                    )}
                  </div>

                  {/* Rush filter */}
                  <label className="inline-flex items-center gap-1.5 shrink-0 px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm text-slate-700 cursor-pointer select-none">
                    <input type="checkbox" checked={rushOnly} onChange={e => { setRushOnly(e.target.checked); track('filter_rush', { on: e.target.checked }) }} className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500/40" />
                    Rush
                  </label>
                  {totalUnread > 0 && (
                    <button
                      type="button"
                      onClick={toggleUnreadOnly}
                      aria-pressed={unreadOnly}
                      title={unreadOnly ? 'Showing only unread — click to show all' : `Show only the ${totalUnread} case${totalUnread === 1 ? '' : 's'} with unread messages`}
                      className={`relative inline-flex items-center gap-1 shrink-0 whitespace-nowrap text-xs font-semibold px-2.5 py-1 rounded-md transition duration-150 transform-gpu active:brightness-95 ${unreadOnly ? 'bg-white text-accent ring-2 ring-accent shadow-inner' : 'bg-accent text-white shadow-sm hover:shadow-md motion-safe:hover:scale-105'}`}
                    >
                      {!unreadOnly && (
                        <span className="pointer-events-none absolute -inset-1 rounded-md bg-accent/40 animate-ping" aria-hidden="true" />
                      )}
                      <span className="relative inline-flex items-center gap-1.5">
                        {unreadOnly ? (
                          <>
                            <IconCheck className="w-3.5 h-3.5" />
                            Unread only
                          </>
                        ) : (
                          <>
                            <IconChat className="w-3.5 h-3.5" />
                            {totalUnread} unread
                          </>
                        )}
                      </span>
                    </button>
                  )}
                  {hasFilters && (
                    <button type="button" onClick={clearFilters} className="shrink-0 px-2.5 py-2 text-sm text-slate-500 hover:text-primary">Clear</button>
                  )}
                  </div>

                  {/* Row 2: view controls (scope + sort) — always their own single line. */}
                  <div className="flex items-center gap-2">
                    <SegmentedControl
                      ariaLabel="Show cases"
                      value={scope}
                      onChange={chooseScope}
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
                      collapseLabels
                      options={[
                        {
                          value: 'recent',
                          label: 'Recently updated',
                          title: 'Sort by most recently updated',
                          icon: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3v5h5" /><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" /><path d="M12 7v5l3.5 2" /></svg>,
                        },
                        {
                          value: 'surgery',
                          label: 'Surgery date',
                          title: 'Sort by soonest surgery/due date',
                          icon: <IconCalendar className="w-3.5 h-3.5" />,
                        },
                      ]}
                    />
                  </div>
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
                      Manage your saved addresses in <Link href="/portal/profile" className="text-primary hover:underline">your profile</Link>.
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
                  <ul className="@container space-y-4">
                    {pagedCases.map((c, idx) => {
                  const s = STATUS_META[c.status]
                  const isActive = activeCaseId === c.id
                  const isFocused = idx === focusIdx
                  return (
                    <li key={c.id} id={`case-row-${idx}`}>
                      <Link
                        href={`/portal/cases/${c.id}`}
                        onClick={() => { rememberListState(); track('case_open', { caseId: c.id, from: 'list' }) }}
                        aria-current={isActive ? 'page' : undefined}
                        className={`group relative block rounded-2xl border transition-all pl-5 pr-4 py-4 overflow-hidden ${isActive ? 'border-primary ring-1 ring-primary/30 bg-primary/[0.03] shadow-md' : 'bg-white border-slate-200 hover:border-primary/40 hover:shadow-md shadow-sm'} ${isFocused ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                      >
                        {/* status accent bar */}
                        <span className={`absolute left-0 top-0 bottom-0 w-1 ${s.bar}`} aria-hidden="true" />

                        <div className="flex flex-col gap-3 @2xl:flex-row @2xl:items-center @2xl:gap-5">
                          {/* identity */}
                          <div className="min-w-0 @2xl:flex-1">
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
                                // Surgery-anchored readiness is what the doctor
                                // actually cares about ("will it arrive before the
                                // appointment?"). Show it when a surgery date exists;
                                // otherwise fall back to the lab's turnaround SLA.
                                if (c.surgeryDate) {
                                  const r = computeSurgeryReadiness(c, now, slaConfig)
                                  if (r.state === 'no-date' || r.state === 'delivered') return null
                                  return (
                                    <span
                                      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ring-1 ring-inset ${READINESS_CHIP[r.state]}`}
                                      title={r.tooltip}
                                    >
                                      {r.label}
                                    </span>
                                  )
                                }
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
                                <span className="text-slate-500">{formatDoctorName(c.doctorName)}</span>
                              )}
                              <span className="inline-flex items-center gap-1.5 text-slate-400 tabular-nums">
                                <IconChat className="w-4 h-4" /> {c.messageCount}
                              </span>
                              {(c.unreadCount ?? 0) > 0 && (
                                <span className="relative inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-accent text-white text-[11px] font-semibold tabular-nums" title={`${c.unreadCount} new message${c.unreadCount === 1 ? '' : 's'}`}>
                                  <span className="pointer-events-none absolute -inset-1 rounded-full bg-accent/50 animate-ping" aria-hidden="true" />
                                  <span className="relative">{c.unreadCount}</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* lifecycle tracker — beside the title when the pane is wide, stacked below when narrow (container-query, not viewport) */}
                          <div className="w-full @2xl:w-[23rem] @4xl:w-[26rem] flex-shrink-0 border-t border-slate-100 pt-3 @2xl:border-t-0 @2xl:pt-0 @2xl:border-l @2xl:border-slate-100 @2xl:pl-5">
                            <StatusTracker status={c.status} order={STAGES_BY_TYPE[c.caseType] ?? DEFAULT_ORDER} />
                          </div>

                          <IconChevron className="hidden @2xl:block w-4 h-4 text-slate-300 group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0" />
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

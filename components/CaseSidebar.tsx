'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { StatusIcon } from './StatusIcon'
import { STATUS_META, type CaseStatus } from '@/lib/case-meta'
import { subscribeCaseEvents } from '@/lib/portal-stream'

interface SidebarCase {
  id: string
  caseNumber: string
  title: string
  patientName?: string
  surgeryDate?: string
  status: CaseStatus
  isRush?: boolean
  doctorName?: string
  unreadCount?: number
}

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

function daysUntil(iso: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((new Date(`${iso}T00:00:00`).getTime() - today.getTime()) / 86_400_000)
}

// Compact countdown to the surgery date. Red within a week, amber within two.
function countdown(iso: string): { text: string; cls: string } {
  const d = daysUntil(iso)
  const cls =
    d <= 7
      ? 'bg-red-50 text-red-700 ring-red-200'
      : d <= 14
      ? 'bg-amber-50 text-amber-700 ring-amber-200'
      : 'bg-slate-100 text-slate-500 ring-slate-200'
  const text = d < 0 ? `${Math.abs(d)}d ago` : d === 0 ? 'Today' : `${d}d`
  return { text, cls }
}

/**
 * Recent-cases navigation sidebar, shared by the dashboard and the case detail
 * page so it's always visible for quick switching between cases.
 *
 * - Pass `cases` (dashboard already has them) to render from that data and stay
 *   in sync with the parent.
 * - Omit `cases` (detail page) and it self-fetches.
 * - `activeId` highlights the currently open case.
 */
export default function CaseSidebar({
  activeId,
  cases: provided,
}: {
  activeId?: string
  cases?: SidebarCase[]
}) {
  const [fetched, setFetched] = useState<SidebarCase[] | null>(null)
  const [loading, setLoading] = useState(!provided)
  const [role, setRole] = useState<'doctor' | 'planner' | 'admin'>('doctor')

  // Track status per case so we can briefly flash a row when its status changes
  // live (via the global stream). flashIds holds the recently-changed case ids.
  const prevStatusRef = useRef<Record<string, CaseStatus>>({})
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set())

  // Derive the active case from the URL so the highlight updates instantly on
  // client-side navigation (no full page load). Falls back to the prop for the
  // initial server render.
  const pathname = usePathname()
  const activeFromPath = pathname?.startsWith('/portal/cases/')
    ? pathname.split('/').pop()
    : undefined
  const currentActive = activeFromPath ?? activeId

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch('/api/portal/cases')
      if (res.ok) {
        const data = await res.json()
        setFetched(data.cases ?? [])
        setRole(data.role ?? 'doctor')
      } else if (!silent) {
        setFetched([])
      }
    } catch {
      if (!silent) setFetched([])
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!provided) load()
  }, [provided, load])

  // Refresh when another view signals the case list changed (e.g. a doctor
  // created a case, or a planner changed a status). Debounced + silent so a
  // burst of events collapses into a single background refetch (no skeleton).
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null
    const handler = () => {
      if (t) clearTimeout(t)
      t = setTimeout(() => load(true), 400)
    }
    window.addEventListener('cases:changed', handler)
    return () => {
      window.removeEventListener('cases:changed', handler)
      if (t) clearTimeout(t)
    }
  }, [load])

  // Refetch when the tab regains focus/visibility (backgrounded mobile tabs
  // freeze and drop the stream, so the sidebar can be stale on reopen).
  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === 'visible') void load(true)
    }
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onFocus)
      window.removeEventListener('focus', onFocus)
    }
  }, [load])

  // Live activity feed via the single shared stream. When any (accessible) case
  // changes, refresh the list + sidebar. The connection is shared app-wide.
  useEffect(() => {
    const unsub = subscribeCaseEvents(e => {
      if (e.event === 'update') window.dispatchEvent(new Event('cases:changed'))
    })
    return unsub
  }, [])

  const cases = provided ?? fetched ?? []

  // Detect status changes since the last render and flash those rows briefly.
  useEffect(() => {
    const prev = prevStatusRef.current
    const changed: string[] = []
    const next: Record<string, CaseStatus> = {}
    for (const c of cases) {
      if (prev[c.id] && prev[c.id] !== c.status) changed.push(c.id)
      next[c.id] = c.status
    }
    prevStatusRef.current = next
    if (changed.length === 0) return
    setFlashIds(new Set(changed))
    const t = setTimeout(() => setFlashIds(new Set()), 1800)
    return () => clearTimeout(t)
  }, [cases])
  // Show active cases plus recently-shipped ones (kept for a couple of days
  // after the surgery date so the doctor still has them handy for reference).
  // The full archive lives in the main list (which has search + filters).
  const SHIPPED_GRACE_DAYS = 2
  const MAX_VISIBLE = 12
  const recent = [...cases]
    .filter(
      c =>
        c.status !== 'shipped' ||
        (!!c.surgeryDate && daysUntil(c.surgeryDate) >= -SHIPPED_GRACE_DAYS)
    )
    // Sort by target surgery date, soonest upcoming first. Cases without a date
    // sink to the bottom. (surgeryDate is YYYY-MM-DD, so string compare is chronological.)
    .sort((a, b) => {
      if (!a.surgeryDate && !b.surgeryDate) return 0
      if (!a.surgeryDate) return 1
      if (!b.surgeryDate) return -1
      return a.surgeryDate.localeCompare(b.surgeryDate)
    })
    .slice(0, MAX_VISIBLE)
  const isLoading = provided ? false : loading

  return (
    <aside className="lg:sticky lg:top-24 self-start" aria-label="Recent cases">
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Upcoming</h2>
          <span className="text-xs text-slate-400 tabular-nums">{recent.length}</span>
        </div>
        {isLoading ? (
          <p className="px-4 py-4 text-slate-400 text-sm">Loading…</p>
        ) : recent.length === 0 ? (
          <p className="px-4 py-4 text-slate-400 text-sm">No upcoming cases.</p>
        ) : (
          <ul className="divide-y divide-slate-50 max-h-[70vh] overflow-y-auto overflow-x-hidden">
            {recent.map(c => {
              const active = c.id === currentActive
              const flash = flashIds.has(c.id)
              const cd = c.surgeryDate && c.status !== 'shipped' ? countdown(c.surgeryDate) : null
              return (
                <li key={c.id}>
                  <Link
                    href={`/portal/cases/${c.id}`}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-start gap-2.5 px-4 py-3 border-l-2 transition-colors duration-700 group ${
                      flash
                        ? 'bg-amber-100 border-amber-400'
                        : active
                        ? 'bg-primary/5 border-primary'
                        : 'border-transparent hover:bg-slate-50'
                    }`}
                  >
                    <StatusIcon status={c.status} className={`mt-0.5 w-4 h-4 flex-shrink-0 transition-colors duration-500 ${STATUS_META[c.status].icon}`} />
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm font-medium break-words transition-colors ${
                        active ? 'text-primary' : 'text-slate-800 group-hover:text-primary'
                      }`}>
                        {c.title}
                      </span>
                      {c.patientName && (
                        <span className="block text-xs text-slate-500 break-words mt-0.5">
                          {c.patientName}
                        </span>
                      )}
                      {c.surgeryDate && (
                        <span className="block text-xs text-slate-500 mt-0.5 whitespace-nowrap">
                          {formatDate(c.surgeryDate)}
                        </span>
                      )}
                      {role !== 'doctor' && c.doctorName && (
                        <span className="block text-xs text-slate-500 break-words mt-0.5">
                          Dr. {c.doctorName}
                        </span>
                      )}
                      <span className="block text-[11px] text-slate-400 tabular-nums mt-0.5">
                        {c.caseNumber} · {STATUS_META[c.status].label}
                      </span>
                    </span>
                    <span className="mt-1 flex-shrink-0 flex flex-col items-end gap-1">
                      {(c.unreadCount ?? 0) > 0 && (
                        <span
                          className="relative inline-flex items-center justify-center min-w-[1.15rem] h-[1.15rem] px-1 rounded-full bg-accent text-white text-[10px] font-bold tabular-nums animate-pulse"
                          title={`${c.unreadCount} unread message${c.unreadCount === 1 ? '' : 's'}`}
                        >
                          <span className="absolute -inset-1 rounded-full bg-accent/50 animate-ping" aria-hidden="true" />
                          <span className="relative">{c.unreadCount}</span>
                        </span>
                      )}
                      {c.isRush && c.status !== 'shipped' && (
                        <span
                          className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ring-1 ring-inset bg-red-600 text-white ring-red-700"
                          title="Rush case"
                        >
                          <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13z" />
                          </svg>
                          Rush
                        </span>
                      )}
                      {c.status === 'shipped' ? (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ring-1 ring-inset bg-emerald-50 text-emerald-700 ring-emerald-200"
                          title="Shipped"
                        >
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M3 5h11v9H3z" />
                            <path d="M14 8h4l3 3v3h-7z" />
                            <circle cx="7" cy="17" r="1.6" />
                            <circle cx="17" cy="17" r="1.6" />
                          </svg>
                          Shipped
                        </span>
                      ) : cd ? (
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ring-1 ring-inset transition-colors duration-500 ${cd.cls}`}
                          title={c.surgeryDate ? `Surgery ${formatDate(c.surgeryDate)}` : undefined}
                        >
                          {cd.text}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
        {!isLoading && cases.length > recent.length && (
          <div className="px-4 py-2.5 border-t border-slate-100">
            <Link href="/portal" className="text-xs font-medium text-primary hover:underline">
              View all {cases.length} cases →
            </Link>
          </div>
        )}
      </div>
    </aside>
  )
}

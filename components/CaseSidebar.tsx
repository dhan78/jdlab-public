'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { subscribeCaseEvents } from '@/lib/portal-stream'

type CaseStatus = 'received' | 'planning' | 'design' | 'review' | 'shipped'

interface SidebarCase {
  id: string
  caseNumber: string
  title: string
  patientName?: string
  surgeryDate?: string
  status: CaseStatus
  doctorName?: string
  lastViewedAt?: string
}

const DOT: Record<CaseStatus, string> = {
  received: 'bg-slate-400',
  planning: 'bg-blue-500',
  design: 'bg-teal-500',
  review: 'bg-amber-500',
  shipped: 'bg-emerald-500',
}

const LABEL: Record<CaseStatus, string> = {
  received: 'Received',
  planning: 'Planning',
  design: 'Design',
  review: 'Review',
  shipped: 'Shipped',
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
 * Recently-viewed cases navigation sidebar, shared by the dashboard and the
 * case detail page so it's always visible for quick switching between cases.
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

  // Derive the active case from the URL so the highlight updates instantly on
  // client-side navigation (no full page load). Falls back to the prop for the
  // initial server render.
  const pathname = usePathname()
  const activeFromPath = pathname?.startsWith('/portal/cases/')
    ? pathname.split('/').pop()
    : undefined
  const currentActive = activeFromPath ?? activeId

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/portal/cases')
      if (res.ok) {
        const data = await res.json()
        setFetched(data.cases ?? [])
        setRole(data.role ?? 'doctor')
      } else {
        setFetched([])
      }
    } catch {
      setFetched([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!provided) load()
  }, [provided, load])

  // Refresh when another view signals the case list changed (e.g. a doctor
  // created a case, or a planner changed a status).
  useEffect(() => {
    const handler = () => load()
    window.addEventListener('cases:changed', handler)
    return () => window.removeEventListener('cases:changed', handler)
  }, [load])

  // Bridge realtime (SSE) events to the local refresh event. The sidebar is
  // mounted across the whole cases area, so subscribing here keeps BOTH the
  // dashboard list and the sidebar live for unread badges and status changes
  // even when no case thread is open. Any live 'update' triggers a refetch.
  useEffect(() => {
    const unsub = subscribeCaseEvents(ev => {
      if (ev.event === 'update') {
        window.dispatchEvent(new Event('cases:changed'))
      }
    })
    return unsub
  }, [])

  const cases = provided ?? fetched ?? []
  // Order by most-recently-viewed first (last time this user opened the case).
  // Cases the user hasn't opened yet fall back to their last-updated time so the
  // nav is never empty; they sort below every viewed case.
  const recent = [...cases]
    .sort((a, b) => {
      const av = a.lastViewedAt ?? ''
      const bv = b.lastViewedAt ?? ''
      if (av && bv) return bv.localeCompare(av)
      if (av) return -1
      if (bv) return 1
      return 0
    })
    .slice(0, 10)
  const isLoading = provided ? false : loading

  return (
    <aside className="lg:sticky lg:top-24 self-start" aria-label="Recently viewed cases">
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Recently viewed</h2>
          <span className="text-xs text-slate-400 tabular-nums">{cases.length}</span>
        </div>
        {isLoading ? (
          <p className="px-4 py-4 text-slate-400 text-sm">Loading…</p>
        ) : recent.length === 0 ? (
          <p className="px-4 py-4 text-slate-400 text-sm">No cases yet.</p>
        ) : (
          <ul className="divide-y divide-slate-50">
            {recent.map(c => {
              const active = c.id === currentActive
              const cd = c.surgeryDate && c.status !== 'shipped' ? countdown(c.surgeryDate) : null
              return (
                <li key={c.id}>
                  <Link
                    href={`/portal/cases/${c.id}`}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-start gap-2.5 px-4 py-3 border-l-2 transition-colors group ${
                      active
                        ? 'bg-primary/5 border-primary'
                        : 'border-transparent hover:bg-slate-50'
                    }`}
                  >
                    <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${DOT[c.status]}`} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm font-medium truncate transition-colors ${
                        active ? 'text-primary' : 'text-slate-800 group-hover:text-primary'
                      }`}>
                        {c.title}
                      </span>
                      {(c.patientName || c.surgeryDate) && (
                        <span className="block text-xs text-slate-500 truncate mt-0.5">
                          {c.patientName}
                          {c.patientName && c.surgeryDate ? ' · ' : ''}
                          {c.surgeryDate ? formatDate(c.surgeryDate) : ''}
                        </span>
                      )}
                      {role !== 'doctor' && c.doctorName && (
                        <span className="block text-xs text-slate-500 truncate mt-0.5">
                          Dr. {c.doctorName}
                        </span>
                      )}
                      <span className="block text-[11px] text-slate-400 tabular-nums mt-0.5">
                        {c.caseNumber} · {LABEL[c.status]}
                      </span>
                    </span>
                    {c.status === 'shipped' ? (
                      <span
                        className="mt-1 flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ring-1 ring-inset bg-emerald-50 text-emerald-700 ring-emerald-200"
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
                        className={`mt-1 flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ring-1 ring-inset ${cd.cls}`}
                        title={c.surgeryDate ? `Surgery ${formatDate(c.surgeryDate)}` : undefined}
                      >
                        {cd.text}
                      </span>
                    ) : null}
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </aside>
  )
}

'use client'

import { Fragment, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { track } from '@/lib/telemetry'
import { computeSurgeryReadiness, type SlaConfigMap } from '@/lib/sla'
import { STATUS_META, STAGES_BY_TYPE, formatDoctorName, type CaseType, type CaseStatus as CaseStatusMeta } from '@/lib/case-meta'

interface SidebarCase {
  id: string
  caseNumber: string
  title: string
  patientName?: string
  surgeryDate?: string
  status: CaseStatusMeta
  doctorName?: string
  lastViewedAt?: string
  // Extra fields (present in the /api/portal/cases payload) used to color the
  // surgery pill by READINESS rather than raw proximity, matching the list.
  caseType?: CaseType
  isRush?: boolean
  scanReceivedAt?: string
  pinned?: boolean
  pinnedAt?: string
}

const DOT_FALLBACK = 'bg-slate-300'

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

// Pushpin icon: filled when pinned, outline when not.
function PinIcon({ filled, className = 'w-4 h-4' }: { filled?: boolean; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 17v5" />
      <path d="M9 10.8V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v5.8a2 2 0 0 0 1.1 1.8l1.4.7a1 1 0 0 1 .5.9V16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-.1a1 1 0 0 1 .5-.9l1.4-.7A2 2 0 0 0 9 10.8Z" />
    </svg>
  )
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
  const [slaConfig, setSlaConfig] = useState<SlaConfigMap>({})

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
        setSlaConfig(data.slaConfig ?? {})
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

  const togglePin = useCallback(async (id: string, pin: boolean) => {
    try {
      await fetch(`/api/portal/cases/${id}/pin`, { method: pin ? 'POST' : 'DELETE' })
      track('case_pin', { caseId: id, pinned: pin })
      // Refresh this rail (self-fetch) and any parent list that owns the data.
      window.dispatchEvent(new Event('cases:changed'))
    } catch {
      /* transient; the rail refreshes on the next load */
    }
  }, [])

  const cases = provided ?? fetched ?? []
  // Pinned cases always show, at the top; the rest fill in by view recency.
  // Cases the user hasn't opened yet fall back to last-updated so the nav is
  // never empty; they sort below every viewed case.
  const byRecency = (a: SidebarCase, b: SidebarCase) => {
    const av = a.lastViewedAt ?? ''
    const bv = b.lastViewedAt ?? ''
    if (av && bv) return bv.localeCompare(av)
    if (av) return -1
    if (bv) return 1
    return 0
  }
  // Pinned cases hold a STABLE position (spatial memory): ordered by pin time
  // (oldest first, new pins append at the bottom) so a click never reorders
  // them. Recency ordering is reserved for the recently-viewed group below.
  const pinnedCases = cases
    .filter(c => c.pinned)
    .sort((a, b) => (a.pinnedAt ?? '').localeCompare(b.pinnedAt ?? ''))
  const recentCases = cases.filter(c => !c.pinned).sort(byRecency).slice(0, 10)
  const recent = [...pinnedCases, ...recentCases]
  const isLoading = provided ? false : loading

  return (
    <aside className="self-start" aria-label="Recently viewed cases">
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{pinnedCases.length > 0 ? 'Cases' : 'Recently viewed'}</h2>
          <span className="text-xs text-slate-400 tabular-nums">{cases.length}</span>
        </div>
        {isLoading ? (
          <p className="px-4 py-4 text-slate-400 text-sm">Loading…</p>
        ) : recent.length === 0 ? (
          <p className="px-4 py-4 text-slate-400 text-sm">No cases yet.</p>
        ) : (
          <ul className="divide-y divide-slate-50">
            {recent.map((c, i) => {
              const isFirstPinned = !!c.pinned && i === 0
              const isFirstRecent = !c.pinned && (i === 0 || !!recent[i - 1]?.pinned)
              const active = c.id === currentActive
              const cd = c.surgeryDate && c.status !== 'shipped' ? countdown(c.surgeryDate) : null
              // Color the pill by whether the case will MAKE the surgery (same
              // logic as the list) — not by how soon surgery is. So a case 5 days
              // out but on track stays neutral instead of alarming red.
              const readiness = c.surgeryDate
                ? computeSurgeryReadiness(
                    {
                      caseType: (c.caseType ?? 'guide') as CaseType,
                      isRush: c.isRush,
                      status: c.status as unknown as CaseStatusMeta,
                      scanReceivedAt: c.scanReceivedAt,
                      surgeryDate: c.surgeryDate,
                    },
                    new Date(),
                    slaConfig
                  )
                : null
              const readinessCls =
                readiness?.state === 'at-risk'
                  ? 'bg-amber-50 text-amber-700 ring-amber-200'
                  : readiness?.state === 'late' || readiness?.state === 'passed'
                  ? 'bg-red-50 text-red-700 ring-red-200'
                  : 'bg-slate-100 text-slate-500 ring-slate-200'
              return (
                <Fragment key={c.id}>
                {isFirstPinned && (
                  <li className="flex items-center gap-1.5 px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-primary/70">
                    <PinIcon filled className="h-3.5 w-3.5" /> Pinned
                  </li>
                )}
                {isFirstRecent && pinnedCases.length > 0 && (
                  <li className="border-t border-slate-100 px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Recently viewed
                  </li>
                )}
                <li className="relative group/row">
                  <Link
                    href={`/portal/cases/${c.id}`}
                    onClick={() => track('case_open', { caseId: c.id, from: 'recent' })}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-start gap-2.5 px-4 py-3 border-l-2 transition-colors group ${
                      active
                        ? 'bg-primary/5 border-primary'
                        : c.pinned
                        ? 'bg-primary/[0.04] border-primary/30 hover:bg-primary/[0.07]'
                        : 'border-transparent hover:bg-slate-50'
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span
                        title={c.title}
                        className={`block text-sm font-medium leading-snug line-clamp-2 transition-colors ${
                          active ? 'text-primary' : 'text-slate-800 group-hover:text-primary'
                        }`}
                      >
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
                          {formatDoctorName(c.doctorName)}
                        </span>
                      )}
                      <span className="block text-[11px] text-slate-400 tabular-nums mt-0.5">
                        {c.caseNumber} · {STATUS_META[c.status]?.label ?? c.status}
                      </span>
                      {(() => {
                        const stages = STAGES_BY_TYPE[(c.caseType ?? 'guide') as CaseType] ?? []
                        const cur = stages.indexOf(c.status)
                        if (cur < 0 || stages.length === 0) return null
                        const fill = STATUS_META[c.status]?.dot ?? DOT_FALLBACK
                        return (
                          <span
                            className="mt-1.5 flex items-center gap-0.5"
                            aria-hidden="true"
                            title={`Stage ${cur + 1} of ${stages.length}`}
                          >
                            {stages.map((s, i) => (
                              <span
                                key={s}
                                className={`h-1 flex-1 rounded-full transition-colors ${i <= cur ? fill : 'bg-slate-200'}`}
                              />
                            ))}
                          </span>
                        )
                      })()}
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
                        className={`mt-1 flex-shrink-0 inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ring-1 ring-inset ${readinessCls}`}
                        title={
                          c.surgeryDate
                            ? `Surgery ${formatDate(c.surgeryDate)}${readiness && readiness.state !== 'ready' ? ' · ' + readiness.label : ''}`
                            : undefined
                        }
                      >
                        <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect x="3" y="4" width="18" height="17" rx="2" />
                          <path d="M3 9h18M8 2v4M16 2v4" />
                        </svg>
                        {cd.text}
                      </span>
                    ) : null}
                  </Link>
                  <button
                    type="button"
                    onClick={() => togglePin(c.id, !c.pinned)}
                    aria-label={c.pinned ? `Unpin ${c.title}` : `Pin ${c.title}`}
                    aria-pressed={!!c.pinned}
                    title={c.pinned ? 'Unpin' : 'Pin to keep in this list'}
                    className={`absolute bottom-1.5 right-1.5 inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                      c.pinned
                        ? 'text-primary hover:bg-primary/10'
                        : 'text-slate-400 hover:bg-slate-100 hover:text-primary'
                    }`}
                  >
                    <PinIcon filled={c.pinned} className="h-[18px] w-[18px]" />
                  </button>
                </li>
                </Fragment>
              )
            })}
          </ul>
        )}
      </div>
    </aside>
  )
}

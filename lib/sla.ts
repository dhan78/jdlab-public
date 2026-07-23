/**
 * SLA / turnaround logic (client-safe — no server-only imports, mirrors
 * lib/case-meta.ts so both the store and UI can compute the same deadline).
 *
 * Model (decided with the lab):
 *   - Turnaround is per CASE TYPE, in BUSINESS days. `isRush` shaves one day.
 *   - The clock STARTS when the lab receives the scan files (case.scanReceivedAt,
 *     set manually by a planner) — NOT at case creation.
 *   - The clock ENDS when the case is shipped. Carrier transit (FedEx overnight)
 *     is after that and not counted.
 *   - due = scanReceivedAt + N business days; a case is AT RISK when it isn't
 *     shipped by its due date.
 */
import type { CaseStatus, CaseType } from './case-meta'

// Standard turnaround per case type, in BUSINESS days. Code defaults — the
// admin-configurable overrides (sla_config table) take precedence when present.
export const SLA_STANDARD_DAYS: Record<CaseType, number> = {
  guide: 3,
  crown: 3,
  bridge: 3,
  veneer: 3,
  inlay: 3,
  implant_crown: 3,
  denture: 5,
  partial: 5,
}

export interface SlaConfigEntry {
  standardDays: number
  rushDays: number
}
export type SlaConfigMap = Partial<Record<CaseType, SlaConfigEntry>>

// Effective SLA for a case in business days. Uses the admin config when a row
// exists for the type; otherwise the code default (rush shaves one day). Floor 1.
export function slaDaysFor(caseType: CaseType, isRush = false, config?: SlaConfigMap): number {
  const cfg = config?.[caseType]
  if (cfg) return Math.max(1, isRush ? cfg.rushDays : cfg.standardDays)
  const std = SLA_STANDARD_DAYS[caseType] ?? 3
  return Math.max(1, isRush ? std - 1 : std)
}

// Add N business days to a date, skipping Sat/Sun. (Holiday calendar: future work.)
export function addBusinessDays(start: Date, n: number): Date {
  const d = new Date(start)
  let added = 0
  while (added < n) {
    d.setDate(d.getDate() + 1)
    const day = d.getDay()
    if (day !== 0 && day !== 6) added++
  }
  return d
}

export type SlaState = 'awaiting-scan' | 'on-track' | 'due-today' | 'overdue' | 'shipped'

export interface SlaInfo {
  state: SlaState
  label: string
  dueDate?: string // ISO
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// Compute the SLA state for a case. `now` is injectable for testing; `config`
// is the admin-configurable turnaround map (falls back to code defaults).
export function computeSla(
  input: { caseType: CaseType; isRush?: boolean; status: CaseStatus; scanReceivedAt?: string | null },
  now: Date = new Date(),
  config?: SlaConfigMap
): SlaInfo {
  if (input.status === 'shipped') return { state: 'shipped', label: 'Shipped' }
  if (!input.scanReceivedAt) {
    // Only genuinely "awaiting scan" before any work starts. A case that has
    // advanced past "received" without a timestamp is a data gap, so don't
    // mislabel active work as awaiting scan.
    return input.status === 'received'
      ? { state: 'awaiting-scan', label: 'Awaiting scan' }
      : { state: 'on-track', label: 'In progress' }
  }

  const due = addBusinessDays(new Date(input.scanReceivedAt), slaDaysFor(input.caseType, input.isRush, config))
  const dueDate = due.toISOString()

  const endOfDue = new Date(due)
  endOfDue.setHours(23, 59, 59, 999)
  if (now.getTime() > endOfDue.getTime()) return { state: 'overdue', label: 'Overdue', dueDate }
  if (due.toDateString() === now.toDateString()) return { state: 'due-today', label: 'Due today', dueDate }

  return { state: 'on-track', label: `Ships by ${fmtDate(due)}`, dueDate }
}

// Tailwind chip classes per state (lib/** is in the Tailwind content globs).
export const SLA_CHIP: Record<SlaState, string> = {
  'awaiting-scan': 'bg-slate-100 text-slate-500 ring-slate-200',
  'on-track': 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  'due-today': 'bg-amber-50 text-amber-700 ring-amber-200',
  overdue: 'bg-red-50 text-red-700 ring-red-200',
  shipped: 'bg-slate-50 text-slate-400 ring-slate-200',
}

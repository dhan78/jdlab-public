/**
 * Shared, client-safe case metadata: statuses, types, per-type lifecycles, and
 * the color/label maps used by the UI. No server-only imports, so both the
 * server store (lib/case-store.ts) and the client components can import it.
 *
 * The lab handles three disciplines, each with its own lifecycle:
 *   - Surgical guides:   Received → Planning → Design → Review → Production → Shipped
 *   - Fixed restorative: Received → Design → Review → Production → Shipped
 *   - Removable pros:    Received → Design → Try-in → Finishing → Shipped
 */

// Superset of every stage across the three disciplines.
export type CaseStatus =
  | 'received'
  | 'planning'
  | 'design'
  | 'review'
  | 'production'
  | 'tryin'
  | 'finishing'
  | 'shipped'

export const CASE_STATUSES: CaseStatus[] = [
  'received',
  'planning',
  'design',
  'review',
  'production',
  'tryin',
  'finishing',
  'shipped',
]

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  received: 'Received',
  planning: 'Planning',
  design: 'Design',
  review: 'Review',
  production: 'Production',
  tryin: 'Try-in',
  finishing: 'Finishing',
  shipped: 'Shipped',
}

// Case types across the disciplines the lab supports.
export type CaseType =
  | 'guide'
  | 'crown'
  | 'bridge'
  | 'veneer'
  | 'inlay'
  | 'implant_crown'
  | 'denture'
  | 'partial'

export const CASE_TYPES: CaseType[] = [
  'guide',
  'crown',
  'bridge',
  'veneer',
  'inlay',
  'implant_crown',
  'denture',
  'partial',
]

export const CASE_TYPE_LABELS: Record<CaseType, string> = {
  guide: 'Surgical Guide',
  crown: 'Crown',
  bridge: 'Bridge',
  veneer: 'Veneer',
  inlay: 'Inlay / Onlay',
  implant_crown: 'Implant Crown',
  denture: 'Full Denture',
  partial: 'Partial Denture',
}

// Grouped for the case-type dropdown (rendered as <optgroup>s).
export const CASE_TYPE_GROUPS: { label: string; types: CaseType[] }[] = [
  { label: 'Surgical', types: ['guide'] },
  { label: 'Fixed restorative', types: ['crown', 'bridge', 'veneer', 'inlay', 'implant_crown'] },
  { label: 'Removable', types: ['denture', 'partial'] },
]

const GUIDE_STAGES: CaseStatus[] = ['received', 'planning', 'design', 'review', 'production', 'shipped']
const FIXED_STAGES: CaseStatus[] = ['received', 'design', 'review', 'production', 'shipped']
const REMOVABLE_STAGES: CaseStatus[] = ['received', 'design', 'tryin', 'finishing', 'shipped']

export const STAGES_BY_TYPE: Record<CaseType, CaseStatus[]> = {
  guide: GUIDE_STAGES,
  crown: FIXED_STAGES,
  bridge: FIXED_STAGES,
  veneer: FIXED_STAGES,
  inlay: FIXED_STAGES,
  implant_crown: FIXED_STAGES,
  denture: REMOVABLE_STAGES,
  partial: REMOVABLE_STAGES,
}

/** Tailwind class bundles per status, used consistently across all views. */
export interface StatusMeta {
  label: string
  chip: string // pill: bg + text + ring
  dot: string // filled bg (tracker node / accent bar)
  bar: string // card accent bar
  ring: string // focus ring color for the current stage
  soft: string // translucent bg for the pulse halo
  text: string // emphasized label text color
  icon: string // standalone icon tint (on light bg)
}

export const STATUS_META: Record<CaseStatus, StatusMeta> = {
  received: {
    label: 'Received',
    chip: 'bg-slate-50 text-slate-600 ring-slate-200',
    dot: 'bg-slate-500',
    bar: 'bg-slate-400',
    ring: 'ring-slate-500/20',
    soft: 'bg-slate-500/25',
    text: 'text-slate-600',
    icon: 'text-slate-500',
  },
  planning: {
    label: 'Planning',
    chip: 'bg-blue-50 text-blue-700 ring-blue-200',
    dot: 'bg-blue-600',
    bar: 'bg-blue-600',
    ring: 'ring-blue-600/20',
    soft: 'bg-blue-600/25',
    text: 'text-blue-700',
    icon: 'text-blue-600',
  },
  design: {
    label: 'Design',
    chip: 'bg-violet-50 text-violet-700 ring-violet-200',
    dot: 'bg-violet-600',
    bar: 'bg-violet-600',
    ring: 'ring-violet-600/20',
    soft: 'bg-violet-600/25',
    text: 'text-violet-700',
    icon: 'text-violet-600',
  },
  review: {
    label: 'Review',
    chip: 'bg-amber-50 text-amber-700 ring-amber-200',
    dot: 'bg-amber-600',
    bar: 'bg-amber-600',
    ring: 'ring-amber-600/20',
    soft: 'bg-amber-600/25',
    text: 'text-amber-700',
    icon: 'text-amber-600',
  },
  production: {
    label: 'Production',
    chip: 'bg-cyan-50 text-cyan-700 ring-cyan-200',
    dot: 'bg-cyan-700',
    bar: 'bg-cyan-700',
    ring: 'ring-cyan-700/20',
    soft: 'bg-cyan-700/25',
    text: 'text-cyan-700',
    icon: 'text-cyan-700',
  },
  tryin: {
    label: 'Try-in',
    chip: 'bg-orange-50 text-orange-700 ring-orange-200',
    dot: 'bg-orange-600',
    bar: 'bg-orange-600',
    ring: 'ring-orange-600/20',
    soft: 'bg-orange-600/25',
    text: 'text-orange-700',
    icon: 'text-orange-600',
  },
  finishing: {
    label: 'Finishing',
    chip: 'bg-teal-50 text-teal-700 ring-teal-200',
    dot: 'bg-teal-600',
    bar: 'bg-teal-600',
    ring: 'ring-teal-600/20',
    soft: 'bg-teal-600/25',
    text: 'text-teal-700',
    icon: 'text-teal-600',
  },
  shipped: {
    label: 'Shipped',
    chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    dot: 'bg-emerald-600',
    bar: 'bg-emerald-600',
    ring: 'ring-emerald-600/20',
    soft: 'bg-emerald-600/25',
    text: 'text-emerald-700',
    icon: 'text-emerald-600',
  },
}

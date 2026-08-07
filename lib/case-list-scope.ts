/**
 * Pure helpers for the case-list middle column: which cases a scope bucket
 * shows, whether a case matches the non-scope filters, and — the reveal-bar
 * decision — whether the currently-open case is hidden from the list *solely*
 * by the scope filter (so a one-click scope switch will actually reveal it).
 *
 * Kept dependency-free so it's unit-testable without React/DOM.
 */

export type Scope = 'active' | 'shipped' | 'all'

/** Minimal shape the list logic needs from a case (structural subset). */
export interface ScopeCase {
  status: string
  isRush?: boolean | null
  unreadCount?: number | null
  patientName?: string | null
  toothRef?: string | null
  title?: string | null
  caseNumber?: string | null
  doctorName?: string | null
  material?: string | null
}

export interface ListFilters {
  rushOnly: boolean
  unreadOnly: boolean
  /** Raw search box text; normalized (trim + lowercase) internally. */
  q: string
}

/** Does a case fall within the given scope bucket? */
export function inScope(status: string, scope: Scope): boolean {
  if (scope === 'all') return true
  if (scope === 'shipped') return status === 'shipped'
  return status !== 'shipped' // 'active' = everything not yet shipped
}

/** Does a case match the non-scope filters (rush / unread / search)? */
export function matchesFilters(c: ScopeCase, f: ListFilters): boolean {
  if (f.rushOnly && !c.isRush) return false
  if (f.unreadOnly && !((c.unreadCount ?? 0) > 0)) return false
  const q = f.q.trim().toLowerCase()
  if (q) {
    const hit = [c.patientName, c.toothRef, c.title, c.caseNumber, c.doctorName, c.material].some(v =>
      v?.toLowerCase().includes(q)
    )
    if (!hit) return false
  }
  return true
}

/** True when there's an active free-text query (whitespace-only doesn't count). */
export function isSearching(f: ListFilters): boolean {
  return f.q.trim() !== ''
}

/**
 * True when a free-text query is active AND this case does NOT match it — i.e.
 * the case is hidden from the list *solely* by the search box (rush/unread are
 * deliberately ignored here). Used to auto-"reveal" a case opened from another
 * surface (Recently-viewed / Pinned rail, or a direct URL): if the open case is
 * hidden only by the search, we clear the search so the selection shows and
 * highlights. Clicking a case that's already visible in the list matches the
 * query, so this returns false and the search is left untouched.
 */
export function searchHidesCase(c: ScopeCase, f: ListFilters): boolean {
  if (!isSearching(f)) return false
  return !matchesFilters(c, { rushOnly: false, unreadOnly: false, q: f.q })
}

/**
 * Whether a case should appear in the list for the given scope + filters.
 *
 * Pattern-1 search: a free-text query searches across ALL statuses, so the
 * scope bucket (Active / Shipped) is ignored WHILE searching — a match in a
 * different status still shows (the row still displays its status). When the
 * query is empty, the scope bucket applies as normal. Rush / unread / search
 * always apply.
 */
export function caseMatchesView(c: ScopeCase, scope: Scope, filters: ListFilters): boolean {
  if (!isSearching(filters) && !inScope(c.status, scope)) return false
  return matchesFilters(c, filters)
}

/** Which scope bucket surfaces a case with this status. */
export function revealScopeFor(status: string): 'active' | 'shipped' {
  return status === 'shipped' ? 'shipped' : 'active'
}

/**
 * The scope the list should adopt to keep the open case visible + highlighted.
 * Keeps the current scope when it already shows the case (including 'all'), and
 * otherwise follows the case into its own bucket. Used to auto-align the filter
 * when the user opens a case from the Recently-viewed / Pinned rail or search.
 */
export function scopeForOpenCase(status: string, current: Scope): Scope {
  return inScope(status, current) ? current : revealScopeFor(status)
}

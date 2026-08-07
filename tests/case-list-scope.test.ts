import { describe, it, expect } from 'vitest'
import {
  inScope,
  matchesFilters,
  caseMatchesView,
  isSearching,
  searchHidesCase,
  scopeForOpenCase,
  revealScopeFor,
  type ScopeCase,
} from '../lib/case-list-scope'

const noFilters = { rushOnly: false, unreadOnly: false, q: '' }
const mkCase = (over: Partial<ScopeCase> = {}): ScopeCase => ({ status: 'in_production', ...over })

describe('inScope', () => {
  it('active shows everything except shipped', () => {
    expect(inScope('in_production', 'active')).toBe(true)
    expect(inScope('received', 'active')).toBe(true)
    expect(inScope('shipped', 'active')).toBe(false)
  })
  it('shipped shows only shipped', () => {
    expect(inScope('shipped', 'shipped')).toBe(true)
    expect(inScope('in_production', 'shipped')).toBe(false)
  })
  it('all shows everything', () => {
    expect(inScope('shipped', 'all')).toBe(true)
    expect(inScope('in_production', 'all')).toBe(true)
  })
})

describe('matchesFilters', () => {
  it('passes when no filters are set', () => {
    expect(matchesFilters(mkCase(), noFilters)).toBe(true)
  })
  it('rushOnly keeps only rush cases', () => {
    expect(matchesFilters(mkCase({ isRush: true }), { ...noFilters, rushOnly: true })).toBe(true)
    expect(matchesFilters(mkCase({ isRush: false }), { ...noFilters, rushOnly: true })).toBe(false)
  })
  it('unreadOnly keeps only cases with unread > 0', () => {
    expect(matchesFilters(mkCase({ unreadCount: 3 }), { ...noFilters, unreadOnly: true })).toBe(true)
    expect(matchesFilters(mkCase({ unreadCount: 0 }), { ...noFilters, unreadOnly: true })).toBe(false)
    expect(matchesFilters(mkCase({ unreadCount: null }), { ...noFilters, unreadOnly: true })).toBe(false)
  })
  it('search matches any field, case-insensitively, and trims', () => {
    const c = mkCase({ patientName: 'Jane Roe', toothRef: '#14', caseNumber: 'DL-1007' })
    expect(matchesFilters(c, { ...noFilters, q: 'jane' })).toBe(true)
    expect(matchesFilters(c, { ...noFilters, q: '  DL-1007 ' })).toBe(true)
    expect(matchesFilters(c, { ...noFilters, q: 'zzz' })).toBe(false)
  })
})

describe('scopeForOpenCase (auto-align on selection)', () => {
  it('follows a shipped case opened while on the Active tab → shipped', () => {
    expect(scopeForOpenCase('shipped', 'active')).toBe('shipped')
  })

  it('follows an active case opened while in the Shipped archive → active', () => {
    expect(scopeForOpenCase('in_production', 'shipped')).toBe('active')
  })

  it('keeps the current scope when it already shows the case', () => {
    expect(scopeForOpenCase('shipped', 'shipped')).toBe('shipped')
    expect(scopeForOpenCase('in_production', 'active')).toBe('active')
  })

  it('keeps "all" scope (it shows everything, so never switches)', () => {
    expect(scopeForOpenCase('shipped', 'all')).toBe('all')
    expect(scopeForOpenCase('in_production', 'all')).toBe('all')
  })
})

describe('revealScopeFor', () => {
  it('maps shipped → shipped', () => {
    expect(revealScopeFor('shipped')).toBe('shipped')
  })
  it('maps every non-shipped status → active', () => {
    expect(revealScopeFor('in_production')).toBe('active')
    expect(revealScopeFor('received')).toBe('active')
    expect(revealScopeFor('design')).toBe('active')
  })
})

describe('isSearching', () => {
  it('is false for empty or whitespace-only queries', () => {
    expect(isSearching({ ...noFilters, q: '' })).toBe(false)
    expect(isSearching({ ...noFilters, q: '   ' })).toBe(false)
  })
  it('is true for a non-empty query', () => {
    expect(isSearching({ ...noFilters, q: 'leon' })).toBe(true)
  })
})

// Pattern-1 search: a free-text query searches across ALL statuses, so the
// scope bucket is ignored while searching (the industry-standard behavior).
describe('caseMatchesView (scope + Pattern-1 search)', () => {
  const shipped = mkCase({ status: 'shipped', patientName: 'Leon Harris' })
  const active = mkCase({ status: 'in_production', patientName: 'Leon Harris' })

  it('with NO query, applies the scope bucket', () => {
    expect(caseMatchesView(active, 'active', noFilters)).toBe(true)
    expect(caseMatchesView(shipped, 'active', noFilters)).toBe(false) // hidden by Active scope
    expect(caseMatchesView(shipped, 'shipped', noFilters)).toBe(true)
    expect(caseMatchesView(active, 'shipped', noFilters)).toBe(false)
    expect(caseMatchesView(shipped, 'all', noFilters)).toBe(true)
  })

  it('a matching query surfaces a SHIPPED case even while on the Active tab', () => {
    expect(caseMatchesView(shipped, 'active', { ...noFilters, q: 'leon' })).toBe(true)
  })

  it('a matching query surfaces an ACTIVE case even while on the Shipped tab', () => {
    expect(caseMatchesView(active, 'shipped', { ...noFilters, q: 'leon' })).toBe(true)
  })

  it('a non-matching query hides the case regardless of scope', () => {
    expect(caseMatchesView(shipped, 'active', { ...noFilters, q: 'zzz' })).toBe(false)
    expect(caseMatchesView(active, 'shipped', { ...noFilters, q: 'zzz' })).toBe(false)
  })

  it('whitespace-only query is NOT a search — scope still applies', () => {
    expect(caseMatchesView(shipped, 'active', { ...noFilters, q: '   ' })).toBe(false)
  })

  it('rush / unread filters still apply on top of a cross-status search', () => {
    const shippedNoRush = mkCase({ status: 'shipped', patientName: 'Leon Harris', isRush: false })
    expect(
      caseMatchesView(shippedNoRush, 'active', { rushOnly: true, unreadOnly: false, q: 'leon' })
    ).toBe(false)
    const shippedUnread = mkCase({ status: 'shipped', patientName: 'Leon Harris', unreadCount: 2 })
    expect(
      caseMatchesView(shippedUnread, 'active', { rushOnly: false, unreadOnly: true, q: 'leon' })
    ).toBe(true)
  })
})

// Reveal-on-cross-surface-open: when a case is opened from the rail / a pinned
// shortcut / a direct URL and it's hidden ONLY by the search box, the list
// clears the search so the selection shows + highlights. Clicking a case that's
// already visible (matches the query) must NOT clear the search.
describe('searchHidesCase (auto-reveal on cross-surface open)', () => {
  const leon = mkCase({ status: 'shipped', patientName: 'Leon Harris' })

  it('is false when there is no active search', () => {
    expect(searchHidesCase(leon, noFilters)).toBe(false)
    expect(searchHidesCase(leon, { ...noFilters, q: '   ' })).toBe(false)
  })

  it('is true when the open case does NOT match the active query (reveal it)', () => {
    expect(searchHidesCase(leon, { ...noFilters, q: 'nobel' })).toBe(true)
  })

  it('is false when the open case DOES match the query (leave search intact)', () => {
    expect(searchHidesCase(leon, { ...noFilters, q: 'leon' })).toBe(false)
  })

  it('ignores rush / unread — only the search box decides a reveal', () => {
    // Case matches the query but not the rush toggle: it's NOT hidden by search,
    // so we must not clear the search (rush is the user's deliberate filter).
    const notRush = mkCase({ status: 'shipped', patientName: 'Leon Harris', isRush: false })
    expect(searchHidesCase(notRush, { rushOnly: true, unreadOnly: false, q: 'leon' })).toBe(false)
  })
})

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// These are source-level guards for the desktop master-detail layout in
// CasesShell. They exist because a subtle, hard-to-reproduce bug shipped twice:
// a long case thread (many messages) rendered ~9400px BELOW the footer, so the
// page had a giant blank void after the footer that scaled with comment count.
//
// Root cause: the detail pane scrolled via `h-full overflow-y-auto`, but the
// react-resizable-panels <Panel> gets its height from `align-items: stretch`
// (no *explicit* height), and Chrome refuses to resolve a child's percentage
// height (`h-full`) against a stretched flex item. The scroller therefore had
// no bound, the thread grew the panel, and it overflowed the fixed-height shell
// (which had `overflow: visible`) straight past the footer.
//
// The fix has two independent guarantees, both asserted below:
//   1. The shell row is clamped with `overflow-hidden` so content can NEVER
//      escape into the document past the footer, regardless of thread length.
//   2. Each pane scrolls internally via `absolute inset-0 overflow-y-auto`
//      (absolute fill works against the panel's *used* box and does not need
//      percentage-height resolution), NOT the fragile `h-full`.
//
// vitest runs in a node env (no DOM/layout engine), so we assert the invariants
// at the source level. If someone reverts any of these, the regression trips.

const shellSource = readFileSync(
  fileURLToPath(new URL('../components/CasesShell.tsx', import.meta.url)),
  'utf8',
)

describe('CasesShell desktop layout invariants (whitespace-after-footer regression)', () => {
  it('clamps the fixed-height shell with overflow-hidden so nothing escapes past the footer', () => {
    // The desktop master-detail container: fixed viewport-derived height AND
    // overflow-hidden. Both must be present on the same element.
    expect(shellSource).toMatch(
      /className="flex items-stretch gap-3 h-\[calc\(100vh-5rem\)\][^"]*\boverflow-hidden\b/,
    )
  })

  it('scrolls each pane internally via absolute inset-0 (not h-full)', () => {
    const absoluteScrollers = shellSource.match(
      /absolute inset-0 overflow-y-auto/g,
    )
    // One scroller for the list pane, one for the detail pane.
    expect(absoluteScrollers?.length ?? 0).toBeGreaterThanOrEqual(2)
  })

  it('does NOT reintroduce the fragile h-full pane scroller that caused the overflow', () => {
    // The exact pattern that broke: a percentage-height scroll container inside
    // a react-resizable-panels <Panel>. It must not come back.
    expect(shellSource).not.toMatch(/h-full overflow-y-auto/)
  })

  it('keeps the panels wrapped in a bounded (h-full min-h-0) flex child', () => {
    // The PanelGroup wrapper still needs an explicit, bounded height so the
    // group/panels resolve their own heights before the absolute scrollers fill.
    expect(shellSource).toMatch(/className="min-w-0 flex-1 h-full min-h-0"/)
  })

  it('marks both panels relative so their absolute scrollers have a positioning context', () => {
    const relativePanels = shellSource.match(/className="relative min-w-0"/g)
    expect(relativePanels?.length ?? 0).toBeGreaterThanOrEqual(2)
  })
})

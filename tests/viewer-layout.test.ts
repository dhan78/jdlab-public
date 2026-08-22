import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Source-level regression guards for the mobile 3D-scan viewer saga. Each of
// these fixes was hard-won and easy to silently revert, so — like
// cases-shell-layout.test.ts — we assert the invariant against the source (vitest
// runs in node, no DOM/layout engine). If someone removes a guard, the test trips.

const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

const thread = read('../components/CaseThread.tsx')
const viewer = read('../components/ScanViewer.tsx')

// THE nasty one. An auto-ingested case's title is a long, unbreakable S3 key. With
// no word-break it forced the page WIDER than the screen; a position:fixed
// full-screen overlay anchors to that too-wide layout viewport, so scrolling right
// pushed the edge-anchored Close/Reset buttons off-screen — the "vanishing buttons"
// bug. Two independent guarantees, both asserted:
//   1. the title can wrap (break-words), so it can't widen the page, AND
//   2. the thread root clamps horizontal overflow, so NOTHING else can either.
describe('CaseThread horizontal-overflow guards (vanishing full-screen buttons)', () => {
  it('lets the case title wrap so a long S3-key title cannot force horizontal overflow', () => {
    expect(thread).toMatch(/<h1 className="[^"]*\bbreak-words\b[^"]*">\{caseDetail\.title\}/)
  })

  it('clamps horizontal overflow on the thread root so the page can never be h-scrollable', () => {
    expect(thread).toMatch(/max-w-3xl[^"]*\boverflow-x-(?:clip|hidden)\b/)
  })
})

// The full-screen controls (Close + Add pin / Measure / Reset) kept getting painted
// UNDER the WebGL canvas on mobile. The fix: the canvas is its own isolated
// stacking context at z-[60] and ALL chrome lives in a separate document.body
// portal layer at z-[70] — two arrangements a mobile WebGL canvas cannot invert.
describe('Viewer full-screen chrome sits above the WebGL canvas', () => {
  it('renders the full-screen canvas layer at z-[60]', () => {
    expect(thread).toMatch(/fixed inset-0 z-\[60\][^"]*bg-slate-950/)
  })

  it('renders the full-screen chrome (Close) in a separate z-[70] layer', () => {
    expect(thread).toMatch(/fixed inset-x-0 top-0 z-\[70\]/)
  })

  it('confines the WebGL canvas to its own stacking context (isolation: isolate)', () => {
    expect(viewer).toMatch(/isolation:\s*'isolate'/)
  })

  it('portals the fullscreen viewer controls to document.body above the canvas', () => {
    expect(viewer).toMatch(
      /createPortal\(<div className="[^"]*z-\[70\][^"]*">\{children\}<\/div>, document\.body\)/,
    )
  })
})

// Touch containment: a drag used to pan the whole fixed surface, and a swipe-left
// navigated to the previous case (Chrome horizontal overscroll history-nav). Fixed
// by locking scroll + disabling overscroll on the <html> element, and touch-none on
// the chrome. The <html> (documentElement) target is the subtle part — body alone
// does NOT disable the swipe-back gesture.
describe('Viewer full-screen touch/scroll containment', () => {
  it('locks page scroll while a viewer is maximized', () => {
    expect(thread).toMatch(/\.overflow = 'hidden'/)
  })

  it('disables horizontal overscroll history-nav on <html> (not just body)', () => {
    expect(thread).toMatch(/document\.documentElement/)
    expect(thread).toMatch(/overscrollBehavior = 'none'/)
  })

  it('marks the full-screen Close chrome touch-none so a drag cannot pan the surface', () => {
    expect(thread).toMatch(/pointer-events-auto[^"]*\btouch-none\b/)
  })
})

// A GLB preview's camera (pan/tilt/zoom) is saved per stable scan key. The
// maximized preview used a ':max' suffix, so full-screen never loaded the camera
// the inline view saved — it reset to the default fit. Inline and maximized must
// share the key (as attachments already do).
describe('Viewer camera view is shared between inline and full-screen', () => {
  it('does not give the maximized GLB preview a separate :max view key', () => {
    expect(thread).not.toMatch(/maximizedPreview\.id\}:max/)
  })
})

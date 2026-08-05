'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Panel, PanelGroup, PanelResizeHandle, type ImperativePanelGroupHandle } from 'react-resizable-panels'
import { subscribeCaseEvents } from '@/lib/portal-stream'
import { track } from '@/lib/telemetry'
import CaseList from './CaseList'
import CaseSidebar from './CaseSidebar'

const RAIL_KEY = 'portal-cases-rail-open'

/**
 * Master-detail shell for the cases area.
 *
 * On desktop (lg+) the case list and the selected case sit side by side in a
 * resizable split — drag the divider to choose how much room each gets, and the
 * layout is remembered per browser (autoSaveId → localStorage). The list lives
 * in the layout, so it stays mounted (scroll + data preserved) as you move
 * between cases; only the detail pane (`children`) swaps.
 *
 * On phones/tablets there isn't room for two panes, so we fall back to the
 * original route-based single-pane flow: the list at /portal, a full-screen
 * thread at /portal/cases/[id].
 */
export default function CasesShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const caseOpen = pathname?.startsWith('/portal/cases/') ?? false

  // Bridge realtime (SSE) events to the window 'cases:changed' refresh signal.
  // This shell is always mounted (any viewport, rail open or collapsed, case
  // open or not), so keeping the bridge here ensures the list + sidebar stay
  // live for unread badges and status changes — the sidebar used to own this,
  // but it can now be collapsed/unmounted.
  useEffect(() => {
    const unsub = subscribeCaseEvents(ev => {
      if (ev.event === 'update') window.dispatchEvent(new Event('cases:changed'))
    })
    return unsub
  }, [])

  // Side-by-side resizing is a desktop-only affordance. Default to desktop for
  // SSR (this view is primarily used on larger screens); the effect corrects it
  // on mount for smaller viewports.
  const [isDesktop, setIsDesktop] = useState(true)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const sync = () => setIsDesktop(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  // Collapsible recently-viewed rail (desktop). Persisted so the choice sticks.
  const [railOpen, setRailOpen] = useState(true)
  useEffect(() => {
    setRailOpen(window.localStorage.getItem(RAIL_KEY) !== 'false')
  }, [])
  const toggleRail = () => {
    setRailOpen(open => {
      const next = !open
      track('rail_toggle', { open: next })
      window.localStorage.setItem(RAIL_KEY, String(next))
      return next
    })
  }

  // Imperative handle so a double-click on the divider snaps back to defaults.
  const groupRef = useRef<ImperativePanelGroupHandle>(null)

  if (!isDesktop) {
    return <div className="min-w-0">{caseOpen ? children : <CaseList />}</div>
  }

  return (
    <div className="flex items-stretch gap-3 h-[calc(100vh-5rem)]">
      {/* Left area: the hamburger lives here (Gmail-style). When open, the
          recently-viewed list sits beneath it; when collapsed only it remains. */}
      <div className={`flex shrink-0 flex-col min-h-0 ${railOpen ? 'w-60' : 'w-9'}`}>
        <button
          type="button"
          onClick={toggleRail}
          data-intent="rail_toggle"
          title={railOpen ? 'Hide recently viewed' : 'Show recently viewed'}
          aria-label={railOpen ? 'Hide recently viewed' : 'Show recently viewed'}
          aria-expanded={railOpen}
          className="mb-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-primary"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
          </svg>
        </button>
        {railOpen && (
          <div className="min-h-0 flex-1 overflow-y-auto pb-4">
            <CaseSidebar />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <PanelGroup
          direction="horizontal"
          autoSaveId="portal-cases-split"
          ref={groupRef}
          className="h-full"
        >
          <Panel id="list" order={1} defaultSize={44} minSize={30} className="min-w-0">
            <div className="h-full overflow-y-auto overflow-x-clip px-4 pb-4">
              <CaseList />
            </div>
          </Panel>

          <PanelResizeHandle className="group relative flex w-3 shrink-0 cursor-col-resize items-stretch justify-center outline-none">
            <div
              className="my-1 w-[3px] rounded-full bg-slate-200 transition-colors group-hover:bg-primary/60 group-data-[resize-handle-state=drag]:bg-primary"
              title="Drag to resize · double-click to reset"
              onDoubleClick={() => groupRef.current?.setLayout([44, 56])}
            />
            <div className="pointer-events-none absolute top-1/2 left-1/2 flex h-8 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md border border-slate-200 bg-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-data-[resize-handle-state=drag]:opacity-100">
              <svg className="h-3.5 w-3.5 text-slate-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <circle cx="7" cy="5" r="1" /><circle cx="7" cy="10" r="1" /><circle cx="7" cy="15" r="1" />
                <circle cx="13" cy="5" r="1" /><circle cx="13" cy="10" r="1" /><circle cx="13" cy="15" r="1" />
              </svg>
            </div>
          </PanelResizeHandle>

          <Panel id="detail" order={2} defaultSize={56} minSize={35} className="min-w-0">
            <div className="h-full overflow-y-auto px-4 pb-4">{children}</div>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import CaseSidebar from './CaseSidebar'

/**
 * Mobile-only ("lg:hidden") access to the Recently viewed sidebar. On desktop
 * the sidebar is always visible in the layout; on small screens it's hidden, so
 * this renders a trigger button that slides the same <CaseSidebar /> in from the
 * left as an overlay drawer.
 *
 * - Closes on: backdrop tap, Escape, or route change (picking a case navigates,
 *   which dismisses the drawer).
 * - Locks body scroll and traps focus while open for accessibility.
 */
export default function MobileRecentDrawer() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Close automatically when the route changes (e.g. a case was selected).
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // While open: lock body scroll, close on Escape, and keep focus inside.
  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Move focus into the panel.
    panelRef.current?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        return
      }
      if (e.key !== 'Tab') return
      // Minimal focus trap: keep Tab within the panel.
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])'
      )
      if (!focusables || focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // Restore focus to the trigger when the drawer closes.
  useEffect(() => {
    if (!open) triggerRef.current?.focus()
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="mobile-recent-drawer"
        title="Recently viewed"
        className="lg:hidden fixed left-0 top-1/2 -translate-y-1/2 z-40 flex items-center gap-1 rounded-r-lg border border-l-0 border-slate-200 bg-white/95 backdrop-blur py-2 pl-1.5 pr-1 text-slate-500 shadow-md hover:bg-slate-50 hover:text-slate-700 transition-colors"
      >
        <svg
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="18" x2="14" y2="18" />
        </svg>
        <span className="sr-only">Recently viewed</span>
        <svg
          className="w-3 h-3"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-[60]" role="presentation">
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close recently viewed"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
          />

          {/* Panel */}
          <div
            id="mobile-recent-drawer"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Recently viewed cases"
            tabIndex={-1}
            className="absolute inset-y-0 left-0 w-[85%] max-w-xs bg-slate-50 shadow-xl outline-none overflow-y-auto"
          >
            <div className="flex items-center justify-end px-4 py-2.5 border-b border-slate-200 bg-white sticky top-0">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="p-1.5 -mr-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="6" y1="18" x2="18" y2="6" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <CaseSidebar />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

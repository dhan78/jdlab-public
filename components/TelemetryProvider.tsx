'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { startTelemetry, track } from '@/lib/telemetry'
import { isKnownIntent } from '@/lib/intents'

/**
 * Mounts once inside the authenticated portal layout. Kicks off the telemetry
 * session (session_start + unload flushing) and records a page_view on every
 * client navigation. Renders nothing.
 */
export default function TelemetryProvider() {
  const pathname = usePathname()

  useEffect(() => {
    startTelemetry()
  }, [])

  // Capture uncaught client errors + unhandled promise rejections so front-end
  // failures land in the same pipeline (flagged kind:'error' server-side).
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      track('client_error', {
        message: String(e.message ?? 'error').slice(0, 500),
        source: e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : undefined,
        stack: e.error?.stack ? String(e.error.stack).slice(0, 2000) : undefined,
      })
    }
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason as { message?: string; stack?: string } | undefined
      track('client_error', {
        reason: 'unhandledrejection',
        message: String(r?.message ?? r ?? 'unhandledrejection').slice(0, 500),
        stack: r?.stack ? String(r.stack).slice(0, 2000) : undefined,
      })
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  useEffect(() => {
    if (pathname) track('page_view', { path: pathname })
  }, [pathname])

  // Global interaction logging: every activation — mouse click, touch tap, or
  // keyboard-activated control — is recorded with the INTENT behind it. Intent
  // is read from a curated `data-intent` attribute on the nearest control (with
  // an optional short, enum/number-only `data-intent-meta`); controls without a
  // declared intent fall back to a PHI-free tag/role descriptor. We NEVER read
  // element text or labels — those can contain patient info.
  useEffect(() => {
    const INTERACTIVE =
      'a,button,input,select,textarea,label,summary,[role="button"],[role="link"],[role="tab"],[role="menuitem"],[role="switch"],[data-intent]'
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null
      if (!target || typeof target.closest !== 'function') return
      // A file input inside a <label> fires a SECOND, synthesized click when the
      // label is clicked — skip it so a single "attach" is one event, not two.
      if (target instanceof HTMLInputElement && target.type === 'file') return
      const el = target.closest(INTERACTIVE) as HTMLElement | null
      if (!el) return
      const intentEl = el.closest('[data-intent]') as HTMLElement | null
      const role = el.getAttribute('role')
      const intent = intentEl?.dataset.intent ?? `${el.tagName.toLowerCase()}${role ? ':' + role : ''}`
      const meta = intentEl?.dataset.intentMeta
      const pointerType = (e as PointerEvent).pointerType || undefined
      // Dev-time taxonomy governance: flag any declared intent that isn't in the
      // registry (typo / forgot to register) so it doesn't silently pollute the
      // warehouse. Stripped in production builds.
      if (process.env.NODE_ENV !== 'production' && intentEl && !isKnownIntent(intentEl.dataset.intent ?? '')) {
        console.warn(`[telemetry] unregistered data-intent "${intentEl.dataset.intent}" — add it to lib/intents.ts`)
      }
      track('ui_click', {
        intent,
        labeled: !!intentEl,
        ...(meta ? { meta } : {}),
        ...(pointerType ? { pointerType } : {}),
      })
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  return null
}

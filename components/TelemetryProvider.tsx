'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { startTelemetry, track } from '@/lib/telemetry'

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

  return null
}

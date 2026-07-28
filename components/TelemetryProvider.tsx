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

  useEffect(() => {
    if (pathname) track('page_view', { path: pathname })
  }, [pathname])

  return null
}

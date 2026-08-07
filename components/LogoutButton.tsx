'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Sign-out action. Lives at the bottom of the profile page (not the header) so
 * it can't be clicked by accident during normal navigation. Clears the session
 * cookie server-side, then routes to the login screen.
 */
export default function LogoutButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const handleLogout = async () => {
    setBusy(true)
    try {
      await fetch('/api/portal/logout', { method: 'POST' })
      router.push('/portal/login')
    } catch {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      data-intent="logout"
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-200 disabled:opacity-50"
      aria-label="Sign out of the portal"
    >
      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M12 4H5a1 1 0 00-1 1v10a1 1 0 001 1h7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 10h8m0 0l-2.5-2.5M17 10l-2.5 2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  )
}

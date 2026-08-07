'use client'

import Link from 'next/link'
import Logo from './Logo'
import NotificationBell from './NotificationBell'

interface PortalHeaderProps {
  name: string
  email: string
  role: 'doctor' | 'planner' | 'admin'
}

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean)
  if (p.length === 0) return '?'
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase()
  return (p[0][0] + p[p.length - 1][0]).toUpperCase()
}

export default function PortalHeader({ name, email, role }: PortalHeaderProps) {
  const roleLabel = role === 'doctor' ? 'Doctor' : role === 'planner' ? 'Planning' : 'Admin'

  return (
    <header
      className="sticky top-0 z-50 border-b border-gray-200 bg-white/90 backdrop-blur-md"
      role="banner"
    >
      <nav
        className="px-4 sm:px-6 lg:px-6"
        aria-label="Portal navigation"
      >
        <div className="mx-auto flex h-16 w-full max-w-[2160px] items-center justify-between">
          {/* Brand → home (also the “My Cases” destination — no separate link needed) */}
          <Link
            href="/portal"
            data-intent="nav_cases"
            className="flex items-center gap-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label="JD Lab Portal — home"
          >
            <Logo />
            <span className="text-sm font-semibold tracking-tight text-primary">Portal</span>
          </Link>

          <div className="flex items-center gap-1 sm:gap-2">
            {role === 'admin' && (
              <Link
                href="/portal/admin"
                data-intent="nav_admin"
                className="hidden rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-primary sm:inline-flex"
                aria-label="Admin dashboard"
              >
                Admin
              </Link>
            )}

            <NotificationBell />

            <span className="mx-0.5 hidden h-6 w-px bg-gray-200 sm:block" aria-hidden="true" />

            {/* Account chip → profile (avatar doubles as the profile link) */}
            <Link
              href="/portal/profile"
              data-intent="nav_profile"
              title={email}
              aria-label="My profile"
              className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-1 transition-colors hover:bg-gray-50 sm:pr-3"
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary ring-1 ring-primary/15"
                aria-hidden="true"
              >
                {initials(name)}
              </span>
              <span className="hidden text-left leading-tight sm:flex sm:flex-col">
                <span className="text-sm font-semibold text-gray-800">{name}</span>
                <span className="text-xs text-gray-500">{roleLabel}</span>
              </span>
            </Link>
          </div>
        </div>
      </nav>
    </header>
  )
}

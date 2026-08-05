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

function IconUser({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <circle cx="10" cy="6.5" r="3" />
      <path d="M4 16c0-3 2.7-4.5 6-4.5s6 1.5 6 4.5" strokeLinecap="round" />
    </svg>
  )
}

export default function PortalHeader({ name, email, role }: PortalHeaderProps) {
  const roleLabel = role === 'doctor' ? 'Doctor' : role === 'planner' ? 'Planning' : 'Admin'

  return (
    <header
      className="sticky top-0 z-50 border-b border-gray-200 bg-white/90 backdrop-blur-md"
      role="banner"
    >
      <nav
        className="container-wide flex h-16 items-center justify-between"
        aria-label="Portal navigation"
      >
        {/* Brand → home (also the “My Cases” destination — no separate link needed) */}
        <Link
          href="/portal"
          className="flex items-center gap-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          aria-label="JD Lab Portal — home"
        >
          <Logo />
          <span className="text-sm font-semibold tracking-tight text-primary">Portal</span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-1.5">
          {role === 'admin' && (
            <Link
              href="/portal/admin"
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-primary sm:inline-flex"
              aria-label="Admin dashboard"
            >
              Admin
            </Link>
          )}

          <Link
            href="/portal/profile"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-primary"
            aria-label="My profile"
          >
            <IconUser className="h-4 w-4" />
            <span className="hidden sm:inline">Profile</span>
          </Link>

          <NotificationBell />

          {/* Identity + sign out */}
          <div
            className="ml-1 flex items-center gap-2.5 border-l border-gray-200 pl-2 sm:pl-3"
            title={email}
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
              aria-hidden="true"
            >
              {initials(name)}
            </div>
            <div className="hidden leading-tight sm:flex sm:flex-col">
              <span className="text-sm font-semibold text-gray-800">{name}</span>
              <span className="text-xs text-gray-500">{roleLabel}</span>
            </div>
          </div>
        </div>
      </nav>
    </header>
  )
}

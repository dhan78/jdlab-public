'use client'

import { useRouter } from 'next/navigation'
import Logo from './Logo'

interface PortalHeaderProps {
  name: string
  email: string
  role: 'doctor' | 'planner' | 'admin'
}

export default function PortalHeader({ name, email, role }: PortalHeaderProps) {
  const router = useRouter()

  const handleLogout = async () => {
    await fetch('/api/portal/logout', { method: 'POST' })
    router.push('/portal/login')
  }

  const casesLabel =
    role === 'doctor' ? 'My Cases' : role === 'planner' ? 'Work Queue' : 'Cases'

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50" role="banner">
      <nav
        className="container-wide flex items-center justify-between py-3"
        aria-label="Portal navigation"
      >
        <a href="/portal" className="flex items-center gap-2" aria-label="JD Lab Portal home">
          <Logo />
          <span className="text-sm font-semibold text-primary ml-1">Portal</span>
        </a>

        <div className="flex items-center gap-4">
          <a
            href="/portal"
            className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            aria-label={casesLabel}
          >
            {casesLabel}
          </a>

          {role === 'admin' && (
            <a
              href="/portal/admin"
              className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              aria-label="Admin dashboard"
            >
              Admin
            </a>
          )}

          {role === 'doctor' && (
            <a
              href="/portal/profile"
              className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              aria-label="My profile"
            >
              Profile
            </a>
          )}

          <div className="hidden sm:flex flex-col items-end leading-tight">
            <span className="text-sm font-semibold text-gray-800" aria-label={`Logged in as ${name}`}>
              {name}
            </span>
            <span className="text-xs text-gray-500">{email}</span>
          </div>

          <button
            onClick={handleLogout}
            className="btn-secondary text-sm px-4 py-2"
            aria-label="Log out of portal"
          >
            Log out
          </button>
        </div>
      </nav>
    </header>
  )
}

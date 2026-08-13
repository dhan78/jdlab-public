'use client'

import { useEffect, useState, type ReactNode } from 'react'

export interface AdminSection {
  key: string
  label: string
  title: string
  description: string
  icon: ReactNode
  content: ReactNode
}

export interface AdminLink {
  label: string
  href: string
  icon: ReactNode
}

interface AdminShellProps {
  sections: AdminSection[]
  links?: AdminLink[]
}

// Sidebar-driven admin dashboard. Every section stays mounted and is toggled
// with `hidden`, so switching is instant and each form keeps its state.
export default function AdminShell({ sections, links = [] }: AdminShellProps) {
  const [active, setActive] = useState(sections[0]?.key ?? '')

  // Deep-link + refresh-safe: reflect the active section in the URL hash.
  useEffect(() => {
    const fromHash = window.location.hash.slice(1)
    if (fromHash && sections.some(s => s.key === fromHash)) setActive(fromHash)
  }, [sections])

  const select = (key: string) => {
    setActive(key)
    history.replaceState(null, '', `#${key}`)
  }

  const current = sections.find(s => s.key === active) ?? sections[0]

  return (
    <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
      <aside className="lg:w-64 shrink-0">
        <nav
          aria-label="Admin sections"
          className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible lg:sticky lg:top-24 pb-2 lg:pb-0"
        >
          {sections.map(s => {
            const isActive = s.key === current?.key
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => select(s.key)}
                data-intent="admin_nav"
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <span className={isActive ? 'text-primary' : 'text-gray-400'}>{s.icon}</span>
                {s.label}
              </button>
            )
          })}

          {links.length > 0 && <div className="hidden lg:block my-2 h-px bg-gray-200" />}

          {links.map(l => (
            <a
              key={l.href}
              href={l.href}
              className="flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              <span className="text-gray-400">{l.icon}</span>
              {l.label}
            </a>
          ))}
        </nav>
      </aside>

      <div className="flex-1 min-w-0">
        {current && (
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-1">{current.title}</h1>
            <p className="text-gray-500">{current.description}</p>
          </div>
        )}

        {sections.map(s => (
          <div key={s.key} className={s.key === current?.key ? '' : 'hidden'}>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
              {s.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

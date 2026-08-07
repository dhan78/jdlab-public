'use client'

import Link from 'next/link'
import { useState } from 'react'
import Logo from './Logo'

// In-page section link. Next's App Router <Link> does NOT reliably scroll when
// only the hash changes on the SAME page (e.g. /#contact -> /#resources), which
// leaves the nav "stuck". This intercepts the click: if the target section
// exists on the current page, smooth-scroll to it; otherwise fall back to
// normal navigation (jumping to the homepage section from another route).
function SectionLink({
  href,
  className,
  children,
  onNavigate,
}: {
  href: string
  className?: string
  children: React.ReactNode
  onNavigate?: () => void
}) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const id = href.split('#')[1]
    const el = id ? document.getElementById(id) : null
    if (el) {
      e.preventDefault()
      el.scrollIntoView({ behavior: 'smooth' })
      window.history.replaceState(null, '', href)
    }
    onNavigate?.()
  }
  return (
    <Link href={href} className={className} onClick={handleClick}>
      {children}
    </Link>
  )
}

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="bg-white/70 backdrop-blur-md text-dark sticky top-0 z-50 shadow-sm">
      <nav className="container-wide flex items-center justify-between py-4 px-4">
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <Logo className="w-24 h-" />
          <span className="font-bold text-xl hidden sm:inline">JD Dental Lab</span>
        </Link>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-8">
          <SectionLink href="/#services" className="hover:text-primary transition">
            Services
          </SectionLink>
          <SectionLink href="/#automation" className="hover:text-primary transition">
            Automation
          </SectionLink>
          <SectionLink href="/#global" className="hover:text-primary transition">
            Global Reach
          </SectionLink>
          <SectionLink href="/#portal" className="hover:text-primary transition">
            Portal
          </SectionLink>
          <SectionLink href="/#resources" className="hover:text-primary transition">
            Resources
          </SectionLink>
          <SectionLink href="/#contact" className="btn-primary">
            Get Started
          </SectionLink>
          <Link
            href="/portal/login"
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-primary border border-gray-300 hover:border-primary rounded-lg px-3 py-1.5 transition-colors"
            title="Doctor Portal"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span>Doctor Login</span>
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden text-dark"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white/90 backdrop-blur-md border-t border-gray-200 px-4 py-4">
          <div className="flex flex-col gap-4">
            <SectionLink
              href="/#services"
              className="text-dark hover:text-primary transition"
              onNavigate={() => setMobileMenuOpen(false)}
            >
              Services
            </SectionLink>
            <SectionLink
              href="/#automation"
              className="text-dark hover:text-primary transition"
              onNavigate={() => setMobileMenuOpen(false)}
            >
              Automation
            </SectionLink>
            <SectionLink
              href="/#global"
              className="text-dark hover:text-primary transition"
              onNavigate={() => setMobileMenuOpen(false)}
            >
              Global Reach
            </SectionLink>
            <SectionLink
              href="/#portal"
              className="text-dark hover:text-primary transition"
              onNavigate={() => setMobileMenuOpen(false)}
            >
              Portal
            </SectionLink>
            <SectionLink
              href="/#resources"
              className="text-dark hover:text-primary transition"
              onNavigate={() => setMobileMenuOpen(false)}
            >
              Resources
            </SectionLink>
            <SectionLink
              href="/#contact"
              className="btn-primary justify-center"
              onNavigate={() => setMobileMenuOpen(false)}
            >
              Get Started
            </SectionLink>
            <Link
              href="/portal/login"
              className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-primary border border-gray-300 hover:border-primary rounded-lg px-4 py-2 transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Doctor Login
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}

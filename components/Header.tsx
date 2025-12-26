'use client'

import Link from 'next/link'
import { useState } from 'react'
import Logo from './Logo'

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
          <Link href="/#services" className="hover:text-primary transition">
            Services
          </Link>
          <Link href="/#automation" className="hover:text-primary transition">
            Automation
          </Link>
          <Link href="/#global" className="hover:text-primary transition">
            Global Reach
          </Link>
          <Link href="/#resources" className="hover:text-primary transition">
            Resources
          </Link>
          <Link href="/#contact" className="btn-primary">
            Get Started
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
            <Link
              href="/#services"
              className="text-dark hover:text-primary transition"
              onClick={() => setMobileMenuOpen(false)}
            >
              Services
            </Link>
            <Link
              href="/#automation"
              className="text-dark hover:text-primary transition"
              onClick={() => setMobileMenuOpen(false)}
            >
              Automation
            </Link>
            <Link
              href="/#global"
              className="text-dark hover:text-primary transition"
              onClick={() => setMobileMenuOpen(false)}
            >
              Global Reach
            </Link>
            <Link
              href="/#resources"
              className="text-dark hover:text-primary transition"
              onClick={() => setMobileMenuOpen(false)}
            >
              Resources
            </Link>
            <Link href="/#contact" className="btn-primary justify-center">
              Get Started
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}

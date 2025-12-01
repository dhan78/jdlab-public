'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="bg-dark text-white sticky top-0 z-50">
      <nav className="container-wide flex items-center justify-between py-4 px-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center font-bold text-lg">
            JD
          </div>
          <span className="font-bold text-xl hidden sm:inline">JD Dental Lab</span>
        </div>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-8">
          <Link href="#services" className="hover:text-secondary transition">
            Services
          </Link>
          <Link href="#automation" className="hover:text-secondary transition">
            Automation
          </Link>
          <Link href="#global" className="hover:text-secondary transition">
            Global Reach
          </Link>
          <Link href="#contact" className="btn-primary">
            Get Started
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden text-white"
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
        <div className="md:hidden bg-dark border-t border-gray-700 px-4 py-4">
          <div className="flex flex-col gap-4">
            <Link
              href="#services"
              className="hover:text-secondary transition"
              onClick={() => setMobileMenuOpen(false)}
            >
              Services
            </Link>
            <Link
              href="#automation"
              className="hover:text-secondary transition"
              onClick={() => setMobileMenuOpen(false)}
            >
              Automation
            </Link>
            <Link
              href="#global"
              className="hover:text-secondary transition"
              onClick={() => setMobileMenuOpen(false)}
            >
              Global Reach
            </Link>
            <button className="btn-primary justify-center">Get Started</button>
          </div>
        </div>
      )}
    </header>
  )
}

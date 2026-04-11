'use client'

import { useState } from 'react'

export default function PortalForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/portal/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })

      if (res.ok) {
        setSubmitted(true)
      } else {
        const data = await res.json()
        setError(data.error ?? 'An error occurred. Please try again.')
      }
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="text-center space-y-4"
      >
        <div className="text-4xl">📧</div>
        <p className="text-gray-700 text-sm">
          If an account with that email exists, a reset link has been sent. Please check your inbox.
        </p>
        <a href="/portal/login" className="text-primary hover:underline text-sm block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
          Back to sign in
        </a>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <p className="text-gray-600 text-sm text-center">
        Enter your email and we&#39;ll send you a reset link.
      </p>

      <div
        role="alert"
        aria-live="polite"
        className={error ? 'p-3 rounded-lg bg-red-50 border border-red-300 text-red-700 text-sm' : 'sr-only'}
      >
        {error || ''}
      </div>

      <div>
        <label htmlFor="forgot-email" className="block text-sm font-semibold text-gray-700 mb-1">
          Email address
        </label>
        <input
          id="forgot-email"
          type="email"
          name="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoComplete="email"
          maxLength={254}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
          aria-required="true"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full py-2.5 disabled:opacity-60 disabled:cursor-not-allowed"
        aria-busy={loading}
      >
        {loading ? 'Sending…' : 'Send reset link'}
      </button>

      <p className="text-center text-sm text-gray-500">
        <a href="/portal/login" className="text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
          Back to sign in
        </a>
      </p>
    </form>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function PortalLoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isExpired = searchParams.get('expired') === 'true'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')

  useEffect(() => {
    if (isExpired) {
      setStatusMessage('Your session has expired. Please log in again.')
    }
  }, [isExpired])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/portal/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })

      const data = await res.json()

      if (res.ok) {
        router.push('/portal')
      } else {
        setError(data.error ?? 'Login failed. Please try again.')
      }
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {statusMessage && (
        <div
          role="alert"
          aria-live="polite"
          className="mb-4 p-3 rounded-lg bg-yellow-50 border border-yellow-300 text-yellow-800 text-sm"
        >
          {statusMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div
          role="alert"
          aria-live="polite"
          className={error ? 'p-3 rounded-lg bg-red-50 border border-red-300 text-red-700 text-sm' : 'sr-only'}
        >
          {error || ''}
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-1">
            Email address
          </label>
          <input
            id="email"
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

        <div>
          <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            name="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            maxLength={128}
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
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="text-center text-sm text-gray-500">
          <a href="/portal/forgot-password" className="text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
            Forgot your password?
          </a>
        </p>
      </form>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

export default function PortalResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing reset link. Please request a new one.')
    }
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/portal/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })

      const data = await res.json()

      if (res.ok) {
        setSuccess(true)
      } else {
        setError(data.error ?? 'Failed to reset password. Please try again.')
      }
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="text-center space-y-4"
      >
        <div className="text-4xl">✅</div>
        <p className="text-gray-700 text-sm font-medium">
          Your password has been reset successfully.
        </p>
        <a href="/portal/login" className="btn-primary inline-block px-6 py-2 text-sm">
          Sign in
        </a>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div
        role="alert"
        aria-live="polite"
        className={error ? 'p-3 rounded-lg bg-red-50 border border-red-300 text-red-700 text-sm' : 'sr-only'}
      >
        {error || ''}
      </div>

      <div>
        <label htmlFor="new-password" className="block text-sm font-semibold text-gray-700 mb-1">
          New password
        </label>
        <input
          id="new-password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
          aria-required="true"
        />
        <p className="text-xs text-gray-500 mt-1">Minimum 8 characters</p>
      </div>

      <div>
        <label htmlFor="confirm-password" className="block text-sm font-semibold text-gray-700 mb-1">
          Confirm new password
        </label>
        <input
          id="confirm-password"
          type="password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
          aria-required="true"
        />
      </div>

      <button
        type="submit"
        disabled={loading || !token}
        className="btn-primary w-full py-2.5 disabled:opacity-60 disabled:cursor-not-allowed"
        aria-busy={loading}
      >
        {loading ? 'Resetting…' : 'Set new password'}
      </button>

      <p className="text-center text-sm text-gray-500">
        <a href="/portal/forgot-password" className="text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
          Request a new reset link
        </a>
      </p>
    </form>
  )
}

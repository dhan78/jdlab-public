'use client'

import { useEffect, useState } from 'react'

interface DemoConfig {
  enabled: boolean
  caseId: string | null
}

/**
 * Admin control for the public read-only demo (`/demo`). The enabled flag is a
 * live kill-switch — toggling it takes effect on the very next request with no
 * redeploy, so the demo link can be shut off instantly if it's abused.
 */
export default function DemoSettingsForm() {
  const [enabled, setEnabled] = useState(false)
  const [caseId, setCaseId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/portal/admin/demo')
        if (!res.ok) throw new Error('load failed')
        const data: DemoConfig = await res.json()
        if (!cancelled) {
          setEnabled(!!data.enabled)
          setCaseId(data.caseId ?? '')
        }
      } catch {
        if (!cancelled) setError('Could not load demo settings.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const save = async (next: { enabled?: boolean; caseId?: string }) => {
    setSaving(true)
    setError('')
    setMsg('')
    try {
      const res = await fetch('/api/portal/admin/demo', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'save failed')
      setEnabled(!!data.enabled)
      setCaseId(data.caseId ?? '')
      setMsg(data.enabled ? 'Demo is LIVE at /demo' : 'Demo is off (/demo returns 404)')
      setTimeout(() => setMsg(''), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-gray-500">Loading demo settings…</p>

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}
      {msg && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">{msg}</div>
      )}

      <p className="text-sm text-gray-500 mb-4">
        Publishes ONE anonymized case at <code className="text-gray-700">/demo</code> as a public,
        read-only 3D preview (no login, no editing) — for QR codes at meetups. Toggling this off
        takes effect immediately; the page then returns 404.
      </p>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <label className="flex-1">
          <span className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">
            Demo case ID
          </span>
          <input
            type="text"
            value={caseId}
            onChange={e => setCaseId(e.target.value)}
            placeholder="e.g. 152XJTP"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            aria-label="Demo case ID"
          />
        </label>
        <button
          type="button"
          onClick={() => save({ caseId })}
          data-intent="demo_case_save"
          disabled={saving}
          className="text-sm font-medium px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition disabled:opacity-60"
        >
          Save case ID
        </button>
      </div>

      <div className="mt-6 flex items-center justify-between rounded-lg border border-gray-200 p-4">
        <div>
          <p className="font-medium text-gray-800">
            Public demo {enabled ? 'is live' : 'is off'}
          </p>
          <p className="text-sm text-gray-500">
            {enabled ? (
              <>Anyone with the link can view <code>/demo</code>.</>
            ) : (
              <>The <code>/demo</code> page returns 404.</>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => save({ enabled: !enabled })}
          data-intent="demo_toggle"
          disabled={saving}
          className={`text-sm font-medium px-4 py-2 rounded-lg text-white shadow-sm transition disabled:opacity-60 ${
            enabled ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-primary/90'
          }`}
        >
          {saving ? 'Saving…' : enabled ? 'Turn off' : 'Turn on'}
        </button>
      </div>
    </div>
  )
}

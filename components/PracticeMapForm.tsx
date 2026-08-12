'use client'

import { useEffect, useState } from 'react'

interface Mapping {
  practiceKey: string
  doctorEmail: string
}

/**
 * Admin control for the practice → doctor mapping used by automated scan
 * ingestion. A source practiceKey (S3 prefix / drop folder / iTero account id)
 * routes incoming scans to a doctor's portal account. Unmapped keys are
 * quarantined by the worker, so mapping a practice here is what "turns on"
 * auto-assignment for it.
 */
export default function PracticeMapForm() {
  const [mappings, setMappings] = useState<Mapping[]>([])
  const [practiceKey, setPracticeKey] = useState('')
  const [doctorEmail, setDoctorEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    try {
      const res = await fetch('/api/portal/admin/practice-map')
      if (!res.ok) throw new Error('load failed')
      const data = await res.json()
      setMappings(data.mappings ?? [])
    } catch {
      setError('Could not load practice mappings.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const add = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/portal/admin/practice-map', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practiceKey, doctorEmail }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'save failed')
      setMappings(data.mappings ?? [])
      setPracticeKey('')
      setDoctorEmail('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (key: string) => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/portal/admin/practice-map?practiceKey=${encodeURIComponent(key)}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'delete failed')
      setMappings(data.mappings ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p className="text-sm text-gray-500">Loading practice mappings…</p>

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}
      <p className="text-sm text-gray-500 mb-4">
        Route incoming scans to a doctor by their source <span className="font-medium">practice key</span>
        (an S3 prefix / drop-folder name / scanner account id). Scans from an unmapped practice are
        quarantined, not guessed.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end mb-6">
        <label className="flex-1">
          <span className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Practice key</span>
          <input
            type="text"
            value={practiceKey}
            onChange={e => setPracticeKey(e.target.value)}
            placeholder="e.g. lindqvist"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </label>
        <label className="flex-1">
          <span className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Doctor email</span>
          <input
            type="email"
            value={doctorEmail}
            onChange={e => setDoctorEmail(e.target.value)}
            placeholder="dr.lindqvist@example.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </label>
        <button
          type="button"
          onClick={add}
          data-intent="practice_map_save"
          disabled={busy || !practiceKey || !doctorEmail}
          className="text-sm font-medium px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 shadow-sm transition disabled:opacity-60"
        >
          Add / update
        </button>
      </div>

      {mappings.length === 0 ? (
        <p className="text-sm text-gray-400">No practice mappings yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-200">
              <th className="py-2 pr-4 font-semibold">Practice key</th>
              <th className="py-2 px-3 font-semibold">Doctor email</th>
              <th className="py-2 pl-3" />
            </tr>
          </thead>
          <tbody>
            {mappings.map(m => (
              <tr key={m.practiceKey} className="border-b border-gray-100">
                <td className="py-2.5 pr-4 font-mono text-gray-800">{m.practiceKey}</td>
                <td className="py-2.5 px-3 text-gray-700">{m.doctorEmail}</td>
                <td className="py-2.5 pl-3 text-right">
                  <button
                    type="button"
                    onClick={() => remove(m.practiceKey)}
                    data-intent="practice_map_delete"
                    disabled={busy}
                    className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-60"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

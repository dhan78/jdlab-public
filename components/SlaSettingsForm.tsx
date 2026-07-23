'use client'

import { useEffect, useState } from 'react'
import { CASE_TYPE_LABELS, type CaseType } from '@/lib/case-meta'

interface SlaSetting {
  caseType: CaseType
  standardDays: number
  rushDays: number
}

export default function SlaSettingsForm() {
  const [settings, setSettings] = useState<SlaSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [savingType, setSavingType] = useState<CaseType | null>(null)
  const [savedType, setSavedType] = useState<CaseType | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/portal/admin/sla')
        if (!res.ok) throw new Error('Failed to load SLA settings')
        const data = await res.json()
        if (!cancelled) setSettings(data.settings ?? [])
      } catch {
        if (!cancelled) setError('Could not load SLA settings.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const update = (caseType: CaseType, field: 'standardDays' | 'rushDays', value: number) => {
    setSettings(prev => prev.map(s => (s.caseType === caseType ? { ...s, [field]: value } : s)))
  }

  const save = async (row: SlaSetting) => {
    setSavingType(row.caseType)
    setSavedType(null)
    setError('')
    try {
      const res = await fetch('/api/portal/admin/sla', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(row),
      })
      if (!res.ok) throw new Error('save failed')
      const data = await res.json()
      setSettings(data.settings ?? settings)
      setSavedType(row.caseType)
      setTimeout(() => setSavedType(null), 2500)
    } catch {
      setError('Could not save. Try again.')
    } finally {
      setSavingType(null)
    }
  }

  if (loading) return <p className="text-sm text-gray-500">Loading turnaround settings…</p>

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}
      <p className="text-sm text-gray-500 mb-4">
        Turnaround per case type, in <span className="font-medium">business days</span>, measured from
        when the lab marks the scans received until the case ships. Rush cases use the rush value.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-200">
              <th className="py-2 pr-4 font-semibold">Case type</th>
              <th className="py-2 px-3 font-semibold">Standard</th>
              <th className="py-2 px-3 font-semibold">Rush</th>
              <th className="py-2 pl-3" />
            </tr>
          </thead>
          <tbody>
            {settings.map(row => (
              <tr key={row.caseType} className="border-b border-gray-100">
                <td className="py-2.5 pr-4 text-gray-800">{CASE_TYPE_LABELS[row.caseType]}</td>
                <td className="py-2.5 px-3">
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={row.standardDays}
                    onChange={e => update(row.caseType, 'standardDays', Number(e.target.value))}
                    className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    aria-label={`${CASE_TYPE_LABELS[row.caseType]} standard days`}
                  />
                </td>
                <td className="py-2.5 px-3">
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={row.rushDays}
                    onChange={e => update(row.caseType, 'rushDays', Number(e.target.value))}
                    className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    aria-label={`${CASE_TYPE_LABELS[row.caseType]} rush days`}
                  />
                </td>
                <td className="py-2.5 pl-3">
                  <button
                    type="button"
                    onClick={() => save(row)}
                    disabled={savingType === row.caseType}
                    className="text-sm font-medium px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary/90 shadow-sm transition disabled:opacity-60"
                  >
                    {savingType === row.caseType ? 'Saving…' : savedType === row.caseType ? 'Saved ✓' : 'Save'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { CASE_TYPES, CASE_TYPE_LABELS, type CaseType } from '@/lib/case-meta'
import { track } from '@/lib/telemetry'

interface CaseDetailsInit {
  title: string
  caseType: CaseType
  patientName?: string
  surgeryDate?: string
  toothRef?: string
  material?: string
  shade?: string
  scannerBrand?: string
  isRush: boolean
  specialInstructions?: string
}

interface CaseDetailsEditorProps {
  caseToken: string
  initial: CaseDetailsInit
  onClose: () => void
  onSaved: () => void
}

const SCANNERS = ['iTero', '3Shape TRIOS', 'Medit', 'Dentsply Sirona', 'Carestream', 'Planmeca', 'Other', 'Physical impression']

const inputField =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-primary focus:ring-1 focus:ring-primary'
const label = 'block text-xs font-medium text-slate-600 mb-1'

export default function CaseDetailsEditor({ caseToken, initial, onClose, onSaved }: CaseDetailsEditorProps) {
  const [form, setForm] = useState({
    title: initial.title ?? '',
    caseType: initial.caseType ?? 'guide',
    patientName: initial.patientName ?? '',
    surgeryDate: initial.surgeryDate ?? '',
    toothRef: initial.toothRef ?? '',
    material: initial.material ?? '',
    shade: initial.shade ?? '',
    scannerBrand: initial.scannerBrand ?? '',
    isRush: initial.isRush ?? false,
    specialInstructions: initial.specialInstructions ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm(f => ({ ...f, [k]: v }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) {
      setError('A case title is required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/portal/cases/${caseToken}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ details: form }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Could not save')
      track('case_details_save', { caseToken })
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Edit case details"
    >
      <form
        onClick={e => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
      >
        <h2 className="text-lg font-bold text-slate-800 mb-1">Case details</h2>
        <p className="text-sm text-slate-500 mb-4">
          Fill in the clinical details for this case so the lab has everything it needs.
        </p>

        {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

        <div className="space-y-3">
          <div>
            <label className={label} htmlFor="cd-title">Case title</label>
            <input id="cd-title" className={inputField} value={form.title} maxLength={200} onChange={e => set('title', e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="cd-type">Case type</label>
              <select id="cd-type" className={inputField} value={form.caseType} onChange={e => set('caseType', e.target.value as CaseType)}>
                {CASE_TYPES.map(t => (
                  <option key={t} value={t}>{CASE_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="cd-tooth">Tooth / ref</label>
              <input id="cd-tooth" className={inputField} value={form.toothRef} maxLength={100} placeholder="#14 or Maxilla" onChange={e => set('toothRef', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="cd-patient">Patient name</label>
              <input id="cd-patient" className={inputField} value={form.patientName} maxLength={200} onChange={e => set('patientName', e.target.value)} />
            </div>
            <div>
              <label className={label} htmlFor="cd-surgery">Target surgery date</label>
              <input id="cd-surgery" type="date" className={inputField} value={form.surgeryDate} onChange={e => set('surgeryDate', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="cd-material">Material</label>
              <input id="cd-material" className={inputField} value={form.material} maxLength={100} onChange={e => set('material', e.target.value)} />
            </div>
            <div>
              <label className={label} htmlFor="cd-shade">Shade</label>
              <input id="cd-shade" className={inputField} value={form.shade} maxLength={20} placeholder="e.g. A2" onChange={e => set('shade', e.target.value)} />
            </div>
            <div>
              <label className={label} htmlFor="cd-scanner">Scanner brand</label>
              <select id="cd-scanner" className={inputField} value={form.scannerBrand} onChange={e => set('scannerBrand', e.target.value)}>
                <option value="">—</option>
                {SCANNERS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={label} htmlFor="cd-notes">Special instructions</label>
            <textarea id="cd-notes" className={inputField} rows={3} value={form.specialInstructions} maxLength={2000} onChange={e => set('specialInstructions', e.target.value)} />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.isRush} onChange={e => set('isRush', e.target.checked)} className="rounded border-slate-300 text-accent focus:ring-accent" />
            Rush case
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <button type="submit" disabled={saving} data-intent="case_details_save" className="btn-primary text-sm disabled:opacity-60">
            {saving ? 'Saving…' : 'Save details'}
          </button>
        </div>
      </form>
    </div>
  )
}

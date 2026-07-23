'use client'

import { useState, useEffect, useCallback } from 'react'

interface PracticeAddress {
  id: string
  label?: string
  address: string
  isPreferred: boolean
  createdAt: string
}

/**
 * Manages a doctor's multiple practice / ship-to addresses.
 * Used by the admin edit form and the doctor's own profile page.
 * Exactly one address is preferred; the first address added becomes preferred
 * automatically, and deleting the preferred one promotes the next.
 */
export default function AddressBook({ doctorId }: { doctorId: string }) {
  const [addresses, setAddresses] = useState<PracticeAddress[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  // Add form
  const [newAddress, setNewAddress] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [adding, setAdding] = useState(false)

  // Inline edit
  const [editId, setEditId] = useState<string | null>(null)
  const [editAddress, setEditAddress] = useState('')
  const [editLabel, setEditLabel] = useState('')

  const base = `/api/portal/doctors/${doctorId}/addresses`

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(base)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setAddresses(data.addresses ?? [])
    } catch {
      setError('Could not load addresses.')
    } finally {
      setLoading(false)
    }
  }, [base])

  useEffect(() => { load() }, [load])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const address = newAddress.trim()
    if (!address) return
    setAdding(true)
    setError('')
    try {
      const res = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, label: newLabel.trim() || undefined }),
      })
      const data = await res.json()
      if (res.ok) {
        setNewAddress('')
        setNewLabel('')
        await load()
      } else {
        setError(data.error ?? 'Failed to add address.')
      }
    } catch {
      setError('An unexpected error occurred.')
    } finally {
      setAdding(false)
    }
  }

  const setPreferred = async (id: string) => {
    setBusyId(id)
    setError('')
    try {
      const res = await fetch(`${base}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPreferred: true }),
      })
      if (res.ok) await load()
      else setError((await res.json()).error ?? 'Failed to update.')
    } catch {
      setError('An unexpected error occurred.')
    } finally {
      setBusyId(null)
    }
  }

  const startEdit = (a: PracticeAddress) => {
    setEditId(a.id)
    setEditAddress(a.address)
    setEditLabel(a.label ?? '')
  }

  const saveEdit = async (id: string) => {
    const address = editAddress.trim()
    if (!address) return
    setBusyId(id)
    setError('')
    try {
      const res = await fetch(`${base}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, label: editLabel.trim() }),
      })
      if (res.ok) {
        setEditId(null)
        await load()
      } else {
        setError((await res.json()).error ?? 'Failed to save.')
      }
    } catch {
      setError('An unexpected error occurred.')
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (id: string) => {
    setBusyId(id)
    setError('')
    try {
      const res = await fetch(`${base}/${id}`, { method: 'DELETE' })
      if (res.ok) await load()
      else setError((await res.json()).error ?? 'Failed to delete.')
    } catch {
      setError('An unexpected error occurred.')
    } finally {
      setBusyId(null)
    }
  }

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary'

  return (
    <div>
      <div
        role="alert"
        aria-live="polite"
        className={error ? 'mb-3 p-2.5 rounded-lg bg-red-50 border border-red-300 text-red-700 text-sm' : 'sr-only'}
      >
        {error || ''}
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm" aria-live="polite">Loading addresses…</p>
      ) : addresses.length === 0 ? (
        <p className="text-gray-500 text-sm mb-3">No addresses yet. Add the first one below — it becomes the preferred address.</p>
      ) : (
        <ul className="space-y-2 mb-4">
          {addresses.map(a => (
            <li key={a.id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 bg-white">
              {editId === a.id ? (
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    value={editLabel}
                    onChange={e => setEditLabel(e.target.value)}
                    placeholder="Label (optional)"
                    maxLength={100}
                    className={inputCls}
                    aria-label="Address label"
                  />
                  <input
                    type="text"
                    value={editAddress}
                    onChange={e => setEditAddress(e.target.value)}
                    maxLength={400}
                    className={inputCls}
                    aria-label="Address"
                  />
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => saveEdit(a.id)}
                      disabled={busyId === a.id}
                      className="btn-primary px-4 py-1.5 text-sm disabled:opacity-60"
                    >
                      {busyId === a.id ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditId(null)}
                      className="text-gray-600 hover:text-gray-800 text-sm font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {a.label && <span className="text-sm font-semibold text-gray-800">{a.label}</span>}
                      {a.isPreferred && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 text-xs font-medium">
                          Preferred
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5 break-words">{a.address}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {!a.isPreferred && (
                      <button
                        type="button"
                        onClick={() => setPreferred(a.id)}
                        disabled={busyId === a.id}
                        className="text-primary hover:text-primary/80 text-sm font-medium disabled:opacity-60"
                      >
                        Set preferred
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => startEdit(a)}
                      className="text-gray-600 hover:text-gray-800 text-sm font-medium"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(a.id)}
                      disabled={busyId === a.id}
                      className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-60"
                      aria-label="Delete address"
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-[minmax(0,10rem)_1fr_auto] gap-2 items-start">
        <input
          type="text"
          value={newLabel}
          onChange={e => setNewLabel(e.target.value)}
          placeholder="Label (optional)"
          maxLength={100}
          className={inputCls}
          aria-label="New address label"
        />
        <input
          type="text"
          value={newAddress}
          onChange={e => setNewAddress(e.target.value)}
          placeholder="Add a practice / ship-to address"
          maxLength={400}
          className={inputCls}
          aria-label="New address"
        />
        <button
          type="submit"
          disabled={adding || !newAddress.trim()}
          className="btn-primary px-5 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {adding ? 'Adding…' : 'Add address'}
        </button>
      </form>
    </div>
  )
}

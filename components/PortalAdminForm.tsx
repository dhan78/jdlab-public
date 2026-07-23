'use client'

import { useState, useEffect, useCallback, Fragment } from 'react'
import AddressBook from './AddressBook'

interface DoctorRow {
  id: string
  name: string
  email: string
  role: string
  createdAt: string
  practiceName?: string
  practiceAddress?: string
  phone?: string
}

export default function PortalAdminForm() {
  const [doctors, setDoctors] = useState<DoctorRow[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [listError, setListError] = useState('')

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [practiceName, setPracticeName] = useState('')
  const [practiceAddress, setPracticeAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<'doctor' | 'planner'>('doctor')
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [deleteStatus, setDeleteStatus] = useState<Record<string, string>>({})

  // --- Inline edit state ---
  interface EditForm {
    name: string
    email: string
    phone: string
    practiceName: string
    role: 'doctor' | 'planner'
    password: string
  }
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const startEdit = (doctor: DoctorRow) => {
    setEditError('')
    setEditingId(doctor.id)
    setEditForm({
      name: doctor.name,
      email: doctor.email,
      phone: doctor.phone ?? '',
      practiceName: doctor.practiceName ?? '',
      role: doctor.role === 'planner' ? 'planner' : 'doctor',
      password: '',
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm(null)
    setEditError('')
  }

  const patchEditForm = (patch: Partial<EditForm>) => {
    setEditForm(prev => (prev ? { ...prev, ...patch } : prev))
  }

  const handleEditSave = async (id: string) => {
    if (!editForm) return
    setEditSaving(true)
    setEditError('')
    try {
      const res = await fetch(`/api/portal/doctors/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name.trim(),
          email: editForm.email.trim(),
          phone: editForm.phone.trim(),
          practiceName: editForm.practiceName.trim(),
          role: editForm.role,
          ...(editForm.password ? { password: editForm.password } : {}),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setDoctors(prev => prev.map(d => (d.id === id ? { ...d, ...data.doctor } : d)))
        cancelEdit()
      } else {
        setEditError(data.error ?? 'Failed to save changes.')
      }
    } catch {
      setEditError('An unexpected error occurred.')
    } finally {
      setEditSaving(false)
    }
  }

  // Auto-fill password with email unless admin has manually changed it
  const handleEmailChange = (val: string) => {
    setEmail(val)
    if (!passwordTouched) {
      setPassword(val.trim())
    }
  }

  const fetchDoctors = useCallback(async () => {
    setLoadingList(true)
    setListError('')
    try {
      const res = await fetch('/api/portal/doctors')
      if (!res.ok) throw new Error('Failed to load doctors')
      const data = await res.json()
      setDoctors(data.doctors ?? [])
    } catch {
      setListError('Could not load doctor list. Please refresh.')
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => { fetchDoctors() }, [fetchDoctors])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    setFormSuccess('')
    setSubmitting(true)

    try {
      const res = await fetch('/api/portal/doctors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          role,
          practiceName: practiceName.trim() || undefined,
          practiceAddress: practiceAddress.trim() || undefined,
          phone: phone.trim() || undefined,
        }),
      })
      const data = await res.json()

      if (res.ok) {
        setFormSuccess(`Doctor "${data.doctor.name}" added successfully.`)
        setName('')
        setEmail('')
        setPassword('')
        setPasswordTouched(false)
        setPracticeName('')
        setPracticeAddress('')
        setPhone('')
        setRole('doctor')
        fetchDoctors()
      } else {
        setFormError(data.error ?? 'Failed to add doctor.')
      }
    } catch {
      setFormError('An unexpected error occurred.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeleteStatus(prev => ({ ...prev, [id]: 'deleting' }))
    try {
      const res = await fetch(`/api/portal/doctors/${id}`, { method: 'DELETE' })
      const data = await res.json()

      if (res.ok) {
        setDoctors(prev => prev.filter(d => d.id !== id))
      } else {
        setDeleteStatus(prev => ({ ...prev, [id]: data.error ?? 'Failed to delete.' }))
      }
    } catch {
      setDeleteStatus(prev => ({ ...prev, [id]: 'An error occurred.' }))
    }
  }

  return (
    <div className="space-y-10">
      {/* Add Doctor Form */}
      <section aria-labelledby="add-doctor-heading">
        <h2 id="add-doctor-heading" className="text-xl font-bold text-gray-800 mb-4">
          Add Doctor Account
        </h2>

        <div
          role="alert"
          aria-live="polite"
          className={formError ? 'mb-4 p-3 rounded-lg bg-red-50 border border-red-300 text-red-700 text-sm' : 'sr-only'}
        >
          {formError || ''}
        </div>
        <div
          role="status"
          aria-live="polite"
          className={formSuccess ? 'mb-4 p-3 rounded-lg bg-green-50 border border-green-300 text-green-700 text-sm' : 'sr-only'}
        >
          {formSuccess || ''}
        </div>

        <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-3 gap-4" noValidate>
          <div>
            <label htmlFor="add-name" className="block text-sm font-semibold text-gray-700 mb-1">
              Full Name
            </label>
            <input
              id="add-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              maxLength={200}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
              aria-required="true"
            />
          </div>

          <div>
            <label htmlFor="add-email" className="block text-sm font-semibold text-gray-700 mb-1">
              Email Address
            </label>
            <input
              id="add-email"
              type="email"
              value={email}
              onChange={e => handleEmailChange(e.target.value)}
              required
              maxLength={254}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
              aria-required="true"
            />
          </div>

          <div>
            <label htmlFor="add-phone" className="block text-sm font-semibold text-gray-700 mb-1">
              Phone
            </label>
            <input
              id="add-phone"
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              maxLength={30}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label htmlFor="add-practice-name" className="block text-sm font-semibold text-gray-700 mb-1">
              Practice Name
            </label>
            <input
              id="add-practice-name"
              type="text"
              value={practiceName}
              onChange={e => setPracticeName(e.target.value)}
              maxLength={200}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="add-practice-address" className="block text-sm font-semibold text-gray-700 mb-1">
              Practice Address
            </label>
            <input
              id="add-practice-address"
              type="text"
              value={practiceAddress}
              onChange={e => setPracticeAddress(e.target.value)}
              maxLength={400}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label htmlFor="add-role" className="block text-sm font-semibold text-gray-700 mb-1">
              Role
            </label>
            <select
              id="add-role"
              value={role}
              onChange={e => setRole(e.target.value as 'doctor' | 'planner')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary bg-white"
            >
              <option value="doctor">Doctor</option>
              <option value="planner">Planner (offshore lab)</option>
            </select>
          </div>

          <div>
            <label htmlFor="add-password" className="block text-sm font-semibold text-gray-700 mb-1">
              Initial Password
            </label>
            <input
              id="add-password"
              type="text"
              value={password}
              onChange={e => { setPassword(e.target.value); setPasswordTouched(true) }}
              required
              minLength={8}
              maxLength={128}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary font-mono text-sm"
              aria-required="true"
              aria-describedby="password-hint"
            />
            <p id="password-hint" className="text-xs text-gray-400 mt-1">Defaults to their email address</p>
          </div>

          <div className="md:col-span-3">
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary px-6 py-2 disabled:opacity-60 disabled:cursor-not-allowed"
              aria-busy={submitting}
            >
              {submitting ? 'Adding…' : 'Add Doctor'}
            </button>
          </div>
        </form>
      </section>

      {/* Doctors List */}
      <section aria-labelledby="doctors-list-heading">
        <h2 id="doctors-list-heading" className="text-xl font-bold text-gray-800 mb-4">
          Registered Doctors
        </h2>

        {listError && (
          <div role="alert" className="p-3 rounded-lg bg-red-50 border border-red-300 text-red-700 text-sm mb-4">
            {listError}
          </div>
        )}

        {loadingList ? (
          <p className="text-gray-500 text-sm" aria-live="polite">Loading…</p>
        ) : doctors.length === 0 ? (
          <p className="text-gray-500 text-sm">No doctors registered yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm text-left text-gray-700" aria-label="Doctor accounts">
              <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Name</th>
                  <th scope="col" className="px-4 py-3">Email</th>
                  <th scope="col" className="px-4 py-3">Phone</th>
                  <th scope="col" className="px-4 py-3">Practice</th>
                  <th scope="col" className="px-4 py-3">Role</th>
                  <th scope="col" className="px-4 py-3">Created</th>
                  <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {doctors.map((doctor, i) => (
                  <Fragment key={doctor.id}>
                  <tr className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 font-medium">{doctor.name}</td>
                    <td className="px-4 py-3">{doctor.email}</td>
                    <td className="px-4 py-3">{doctor.phone ?? <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{doctor.practiceName ?? <span className="text-gray-400">—</span>}</div>
                      {doctor.practiceAddress && <div className="text-xs text-gray-400 mt-0.5">{doctor.practiceAddress}</div>}
                    </td>
                    <td className="px-4 py-3 capitalize">{doctor.role}</td>
                    <td className="px-4 py-3">{new Date(doctor.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      {doctor.role !== 'admin' ? (
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => (editingId === doctor.id ? cancelEdit() : startEdit(doctor))}
                            className="text-primary hover:text-primary/80 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                            aria-label={`Edit ${doctor.name}`}
                            aria-expanded={editingId === doctor.id}
                          >
                            {editingId === doctor.id ? 'Close' : 'Edit'}
                          </button>
                          <button
                            onClick={() => handleDelete(doctor.id)}
                            disabled={deleteStatus[doctor.id] === 'deleting'}
                            className="text-red-600 hover:text-red-800 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded disabled:opacity-50"
                            aria-label={`Delete ${doctor.name}`}
                          >
                            {deleteStatus[doctor.id] === 'deleting' ? 'Deleting…' : 'Delete'}
                          </button>
                          {deleteStatus[doctor.id] && deleteStatus[doctor.id] !== 'deleting' && (
                            <span
                              role="alert"
                              className="block text-xs text-red-500 mt-1"
                            >
                              {deleteStatus[doctor.id]}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">Admin</span>
                      )}
                    </td>
                  </tr>
                  {editingId === doctor.id && editForm && (
                    <tr className="bg-primary/5">
                      <td colSpan={7} className="px-4 py-5">
                        <div
                          role="alert"
                          aria-live="polite"
                          className={editError ? 'mb-4 p-3 rounded-lg bg-red-50 border border-red-300 text-red-700 text-sm' : 'sr-only'}
                        >
                          {editError || ''}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label htmlFor={`edit-name-${doctor.id}`} className="block text-sm font-semibold text-gray-700 mb-1">Full Name</label>
                            <input
                              id={`edit-name-${doctor.id}`}
                              type="text"
                              value={editForm.name}
                              onChange={e => patchEditForm({ name: e.target.value })}
                              maxLength={200}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
                            />
                          </div>
                          <div>
                            <label htmlFor={`edit-email-${doctor.id}`} className="block text-sm font-semibold text-gray-700 mb-1">Email Address</label>
                            <input
                              id={`edit-email-${doctor.id}`}
                              type="email"
                              value={editForm.email}
                              onChange={e => patchEditForm({ email: e.target.value })}
                              maxLength={254}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
                            />
                          </div>
                          <div>
                            <label htmlFor={`edit-phone-${doctor.id}`} className="block text-sm font-semibold text-gray-700 mb-1">Phone</label>
                            <input
                              id={`edit-phone-${doctor.id}`}
                              type="tel"
                              value={editForm.phone}
                              onChange={e => patchEditForm({ phone: e.target.value })}
                              maxLength={30}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label htmlFor={`edit-practice-name-${doctor.id}`} className="block text-sm font-semibold text-gray-700 mb-1">Practice Name</label>
                            <input
                              id={`edit-practice-name-${doctor.id}`}
                              type="text"
                              value={editForm.practiceName}
                              onChange={e => patchEditForm({ practiceName: e.target.value })}
                              maxLength={200}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
                            />
                          </div>
                          <div>
                            <label htmlFor={`edit-role-${doctor.id}`} className="block text-sm font-semibold text-gray-700 mb-1">Role</label>
                            <select
                              id={`edit-role-${doctor.id}`}
                              value={editForm.role}
                              onChange={e => patchEditForm({ role: e.target.value as 'doctor' | 'planner' })}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary bg-white"
                            >
                              <option value="doctor">Doctor</option>
                              <option value="planner">Planner (offshore lab)</option>
                            </select>
                          </div>
                          <div className="md:col-span-2">
                            <label htmlFor={`edit-password-${doctor.id}`} className="block text-sm font-semibold text-gray-700 mb-1">New Password</label>
                            <input
                              id={`edit-password-${doctor.id}`}
                              type="text"
                              value={editForm.password}
                              onChange={e => patchEditForm({ password: e.target.value })}
                              minLength={8}
                              maxLength={128}
                              placeholder="Leave blank to keep current password"
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary font-mono text-sm"
                              aria-describedby={`edit-password-hint-${doctor.id}`}
                            />
                            <p id={`edit-password-hint-${doctor.id}`} className="text-xs text-gray-400 mt-1">Min 8 characters. Leave blank to keep the current password.</p>
                          </div>
                          <div className="md:col-span-3">
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">Practice / Ship-to Addresses</h4>
                            <AddressBook doctorId={doctor.id} />
                          </div>
                          <div className="md:col-span-3 flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleEditSave(doctor.id)}
                              disabled={editSaving}
                              className="btn-primary px-6 py-2 disabled:opacity-60 disabled:cursor-not-allowed"
                              aria-busy={editSaving}
                            >
                              {editSaving ? 'Saving…' : 'Save Changes'}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              disabled={editSaving}
                              className="px-6 py-2 text-gray-600 hover:text-gray-800 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 rounded-lg disabled:opacity-60"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

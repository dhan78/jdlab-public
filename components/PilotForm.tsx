'use client'

import { useState } from 'react'

const SCANNERS = ['iTero', '3Shape TRIOS', 'Medit', 'Dentsply Sirona', 'Other', 'Not sure yet']
const VOLUMES = ['1–5 cases', '6–20 cases', '21–50 cases', '50+ cases']

export default function PilotForm() {
  const [formData, setFormData] = useState({
    name: '',
    practiceName: '',
    email: '',
    phone: '',
    scannerBrand: '',
    monthlyVolume: '',
    notes: '',
  })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'pilot',
          name: formData.name,
          practiceName: formData.practiceName,
          email: formData.email,
          phone: formData.phone,
          scannerBrand: formData.scannerBrand,
          monthlyVolume: formData.monthlyVolume,
          message: formData.notes,
        }),
      })
      if (res.ok) {
        setSubmitted(true)
        setFormData({
          name: '',
          practiceName: '',
          email: '',
          phone: '',
          scannerBrand: '',
          monthlyVolume: '',
          notes: '',
        })
        setTimeout(() => setSubmitted(false), 6000)
      }
    } catch (error) {
      console.error('Error submitting pilot form:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section id="request-pilot" className="section-padding bg-white">
      <div className="container-wide max-w-3xl">
        <div className="text-center mb-10">
          <h2 className="text-4xl font-bold mb-4">Request a Free Pilot</h2>
          <p className="text-xl text-gray-600">
            We&apos;ll onboard your practice and run your first case free. No scanner switch required.
          </p>
        </div>

        <div className="bg-light p-8 rounded-lg">
          {submitted && (
            <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
              Thank you! We&apos;ll reach out within 1 business day.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">
                  Your Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label htmlFor="practiceName" className="block text-sm font-semibold text-gray-700 mb-2">
                  Practice Name
                </label>
                <input
                  type="text"
                  id="practiceName"
                  name="practiceName"
                  value={formData.practiceName}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="scannerBrand" className="block text-sm font-semibold text-gray-700 mb-2">
                  Which scanner do you use?
                </label>
                <select
                  id="scannerBrand"
                  name="scannerBrand"
                  value={formData.scannerBrand}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary bg-white"
                >
                  <option value="">Select…</option>
                  {SCANNERS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="monthlyVolume" className="block text-sm font-semibold text-gray-700 mb-2">
                  Approx. digital cases / month
                </label>
                <select
                  id="monthlyVolume"
                  name="monthlyVolume"
                  value={formData.monthlyVolume}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary bg-white"
                >
                  <option value="">Select… (optional)</option>
                  {VOLUMES.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-semibold text-gray-700 mb-2">
                Anything else? (optional)
              </label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-60">
              {loading ? 'Sending…' : 'Request My Pilot'}
            </button>
            <p className="text-center text-sm text-gray-500">
              No patient data needed to sign up — we&apos;ll set up a BAA before any real cases.
            </p>
          </form>
        </div>
      </div>
    </section>
  )
}

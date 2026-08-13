import TelemetryViewer from '@/components/TelemetryViewer'
import Link from 'next/link'

export const metadata = {
  title: 'Session Timeline — JD Dental Lab Portal',
}

// Admin-only (middleware guards /portal/admin/*). Read-only session replay of
// interaction telemetry; no message/patient text is stored or shown.
export default function TelemetryPage() {
  return (
    <section className="section-padding">
      <div className="container-wide">
        <Link
          href="/portal/admin"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-primary transition-colors mb-4"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to Admin
        </Link>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Session Timeline</h1>
          <p className="text-gray-500">
            Reproduce what a user did, step by step. Interaction metadata only — no message or patient content.
          </p>
        </div>
        <TelemetryViewer />
      </div>
    </section>
  )
}

import TelemetryViewer from '@/components/TelemetryViewer'

export const metadata = {
  title: 'Session Timeline — JD Dental Lab Portal',
}

// Admin-only (middleware guards /portal/admin/*). Read-only session replay of
// interaction telemetry; no message/patient text is stored or shown.
export default function TelemetryPage() {
  return (
    <section className="section-padding">
      <div className="container-wide">
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

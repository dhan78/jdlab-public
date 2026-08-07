import Link from 'next/link'
import SleepyPuppy from '@/components/SleepyPuppy'

// Custom 404 boundary for /demo. `notFound()` in app/demo/page.tsx (demo turned
// off, no case configured, or case missing) renders THIS — so a disabled demo
// still returns HTTP 404 (nothing for a bad actor to probe) but a human sees a
// warm, on-brand page instead of a bare error. Inline SVG art = no external
// image dependency and no extra request.
export const metadata = {
  title: 'Sample case unavailable — JD Dental Lab',
  robots: { index: false, follow: false },
}

export default function DemoNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-white to-slate-50 px-6 py-16">
      <div className="w-full max-w-lg text-center">
        {/* Friendly puppy — kept clean and minimal to stay professional. */}
        <SleepyPuppy className="mx-auto h-40 w-40" />

        <h1 className="mt-6 text-2xl font-bold text-gray-900 sm:text-3xl">
          Our sample case is taking a nap
        </h1>
        <p className="mx-auto mt-3 max-w-md text-base text-gray-600">
          The live 3D demo isn’t available right now. Don’t worry — the rest of
          the lab is wide awake and ready to help with your cases.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90"
          >
            Back to JD Dental Lab
          </Link>
          <a
            href="/#contact"
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Talk to our team
          </a>
        </div>
      </div>
    </main>
  )
}

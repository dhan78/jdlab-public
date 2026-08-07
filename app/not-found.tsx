import Link from 'next/link'
import SleepyPuppy from '@/components/SleepyPuppy'

// Global 404 boundary. Next renders THIS for any unmatched public route (e.g. a
// mistyped URL or an old link like /upload), so visitors get a warm, on-brand
// page — with the sleepy-puppy mascot — instead of the bare default 404. Inline
// SVG art = no external image request. Route-scoped not-found.tsx files (e.g.
// /demo, portal cases) still override this where a more specific message fits.
export const metadata = {
  title: 'Page not found — JD Dental Lab',
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-white to-slate-50 px-6 py-16">
      <div className="w-full max-w-lg text-center">
        {/* Friendly puppy — kept clean and minimal to stay professional. */}
        <SleepyPuppy className="mx-auto h-40 w-40" />

        <p className="mt-6 text-sm font-semibold uppercase tracking-wide text-primary">404</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">
          This page went walkies
        </h1>
        <p className="mx-auto mt-3 max-w-md text-base text-gray-600">
          The page you’re looking for isn’t here. It may have moved — but the
          rest of the lab is wide awake and ready to help with your cases.
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

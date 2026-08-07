import Link from 'next/link'
import SleepyPuppy from '@/components/SleepyPuppy'

export const metadata = {
  title: 'Case not found — JD Dental Lab Portal',
  robots: { index: false, follow: false },
}

// Rendered by `notFound()` in cases/[id]/page.tsx when a case id is mistyped,
// deleted, or not visible to the signed-in doctor. Because this lives inside
// the (cases) route group, it shows INSIDE the detail pane — the case list
// stays put on desktop, so the user isn't stranded and can pick another case.
// A missing case is a calm, expected state, so it's styled neutrally (no red
// error alert) with a clear way back.
export default function CaseNotFound() {
  return (
    <div className="flex min-h-full items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm text-center">
        <SleepyPuppy className="mx-auto h-32 w-32" />

        <h1 className="mt-5 text-xl font-bold text-slate-900">
          We couldn’t find that case
        </h1>
        <p className="mx-auto mt-2 max-w-xs text-sm text-slate-600">
          It may have been moved, or the link isn’t quite right. Pick a case
          from your list to jump back in.
        </p>

        <Link
          href="/portal"
          className="mt-6 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M12 5l-5 5 5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to cases
        </Link>
      </div>
    </div>
  )
}

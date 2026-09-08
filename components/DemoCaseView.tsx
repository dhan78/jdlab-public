'use client'

/**
 * Read-only demo case view — the public surface behind `/demo`.
 *
 * Renders ONE curated, anonymized case's 3D scan(s) with the lab's pins and
 * measurements, but with NO authoring controls and NO write paths. All data is
 * fetched server-side and passed in as plain props; this component never calls a
 * portal API, so an anonymous visitor can look but cannot touch anything.
 */
import { useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import Logo from './Logo'
import type { ScanAnnotation } from './ScanViewer'

const ScanViewer = dynamic(() => import('./ScanViewer'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">
      Loading 3D viewer…
    </div>
  ),
})

export interface DemoModel {
  id: string
  name: string
  dataUrl: string
  annotations: ScanAnnotation[]
}

export interface DemoCaseViewProps {
  title: string
  caseType: string
  status: string
  toothRef?: string
  material?: string
  turnaround?: string
  models: DemoModel[]
}

export default function DemoCaseView({
  title,
  caseType,
  status,
  toothRef,
  material,
  turnaround,
  models,
}: DemoCaseViewProps) {
  // CSS-overlay "maximize" (not the native Fullscreen API, which iOS Safari
  // blocks on non-<video> elements) so the 3D scan can go full-window on a phone.
  const [maximized, setMaximized] = useState<DemoModel | null>(null)
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Demo banner */}
      <div className="bg-primary text-white">
        <div className="container-wide flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
          <Link
            href="/"
            aria-label="JD Dental Lab — back to home"
            className="flex items-center gap-2 font-medium transition hover:opacity-90"
          >
            <Logo className="h-8 w-auto rounded bg-white/95 p-1" />
            <span>JD Dental Lab — live sample case</span>
          </Link>
          <span className="text-white/80">Read-only preview · spin, zoom &amp; explore the 3D scan</span>
        </div>
      </div>

      <div className="container-wide py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-white px-2.5 py-1 text-slate-600 ring-1 ring-inset ring-slate-200">
              {caseType}
            </span>
            <span className="rounded-full bg-white px-2.5 py-1 text-slate-600 ring-1 ring-inset ring-slate-200">
              {status}
            </span>
            {toothRef && (
              <span className="rounded-full bg-white px-2.5 py-1 text-slate-600 ring-1 ring-inset ring-slate-200">
                Tooth {toothRef}
              </span>
            )}
            {material && (
              <span className="rounded-full bg-white px-2.5 py-1 text-slate-600 ring-1 ring-inset ring-slate-200">
                {material}
              </span>
            )}
            {turnaround && (
              <span className="rounded-full bg-secondary/10 px-2.5 py-1 text-secondary ring-1 ring-inset ring-secondary/20">
                {turnaround}
              </span>
            )}
          </div>
        </header>

        {models.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">
            This sample case has no 3D scan attached.
          </div>
        ) : (
          <div className="space-y-6">
            {models.map(m => (
              <div key={m.id}>
                <div className="group relative h-[28rem] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
                  <ScanViewer
                    url={m.dataUrl}
                    className="h-full w-full"
                    viewKey={`demo:${m.id}`}
                    annotations={m.annotations}
                    readOnly
                  />
                  <button
                    type="button"
                    onClick={() => setMaximized(m)}
                    title="Expand to full screen"
                    aria-label="Expand to full screen"
                    className="absolute right-2 top-2 rounded-lg bg-black/40 p-2 text-white/90 backdrop-blur-sm transition hover:bg-black/60"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4" /></svg>
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-slate-500">
                  {m.name.replace(/\.[^./\\]+$/, '')}
                  {m.annotations.length > 0 && (
                    <span> · {m.annotations.length} lab annotation{m.annotations.length === 1 ? '' : 's'} — click a marker to read the note</span>
                  )}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-10 rounded-xl border border-slate-200 bg-white p-6 text-center">
          <p className="text-slate-700">
            This is how you&apos;ll review every case with <span className="font-semibold">JD Dental Lab</span> —
            in 3D, with the lab&apos;s margins and measurements marked right on the model.
          </p>
          <a
            href="#request-pilot"
            className="btn-primary mt-4 inline-block"
          >
            Talk to us about your cases
          </a>
        </div>
      </div>

      {/* Full-window viewer (CSS overlay — works on mobile). */}
      {maximized && (
        <div className="fixed inset-0 z-50 bg-slate-900">
          <ScanViewer
            url={maximized.dataUrl}
            className="h-full w-full"
            viewKey={`demo:${maximized.id}`}
            annotations={maximized.annotations}
            readOnly
          />
          <button
            type="button"
            onClick={() => setMaximized(null)}
            aria-label="Close full screen"
            className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-lg bg-black/50 px-3 py-2 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-black/70"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
            Close
          </button>
        </div>
      )}
    </div>
  )
}

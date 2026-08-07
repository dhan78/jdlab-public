'use client'

/**
 * Read-only demo case view — the public surface behind `/demo`.
 *
 * Renders ONE curated, anonymized case's 3D scan(s) with the lab's pins and
 * measurements, but with NO authoring controls and NO write paths. All data is
 * fetched server-side and passed in as plain props; this component never calls a
 * portal API, so an anonymous visitor can look but cannot touch anything.
 */
import dynamic from 'next/dynamic'
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
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Demo banner */}
      <div className="bg-primary text-white">
        <div className="container-wide flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
          <span className="font-medium">JD Dental Lab — live sample case</span>
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
                <div className="h-[28rem] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
                  <ScanViewer
                    url={m.dataUrl}
                    className="h-full w-full"
                    annotations={m.annotations}
                    readOnly
                  />
                </div>
                <p className="mt-1.5 text-xs text-slate-500">
                  {m.name}
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
            href="/#contact"
            className="btn-primary mt-4 inline-block"
          >
            Talk to us about your cases
          </a>
        </div>
      </div>
    </div>
  )
}

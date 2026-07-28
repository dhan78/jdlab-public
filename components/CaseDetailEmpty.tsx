/**
 * Placeholder shown in the detail pane on desktop when no case is selected
 * (i.e. at /portal). On mobile the shell renders the list here instead, so this
 * is effectively a desktop-only empty state.
 */
export default function CaseDetailEmpty() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/50 px-6 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
        <svg className="h-7 w-7 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M4 6.5h16a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 20 16.5H10l-4.5 3.5V16.5H4A1.5 1.5 0 0 1 2.5 15V8A1.5 1.5 0 0 1 4 6.5Z" strokeLinejoin="round" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-slate-700">Select a case</h2>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        Choose a case from the list to view its messages, files, and status here.
      </p>
    </div>
  )
}

import CaseSidebar from '@/components/CaseSidebar'

/**
 * Layout for the cases area (dashboard + case detail). Because this is a
 * layout, it persists across navigations within the group — so the sidebar
 * mounts ONCE and stays mounted while you move between cases. Only {children}
 * (the dashboard list or a case thread) swaps out.
 *
 * The route group "(cases)" does not affect the URL: the dashboard is still
 * /portal and a case is still /portal/cases/[id]. Admin lives outside this
 * group, so it gets no sidebar.
 */
export default function CasesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <section className="px-4 sm:px-6 lg:px-8 pt-6 pb-16">
      <div className="container-wide">
        <div className="grid grid-cols-1 lg:grid-cols-[264px_1fr] gap-8 items-start">
          <div className="hidden lg:block lg:sticky lg:top-16 lg:self-start lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto">
            <CaseSidebar />
          </div>
          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </section>
  )
}

import MobileRecentDrawer from '@/components/MobileRecentDrawer'
import CasesShell from '@/components/CasesShell'

/**
 * Layout for the cases area (list + case detail). The list-detail split lives in
 * CasesShell and persists across navigations within this group, so the list
 * stays mounted while you move between cases — only the detail pane swaps.
 *
 * The route group "(cases)" does not affect the URL: the list is still /portal
 * and a case is still /portal/cases/[id]. Admin lives outside this group.
 */
export default function CasesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // h-full only on desktop: there the section fills the frame so the resizable
    // panes scroll internally. On mobile the content flows in <main>'s own scroll,
    // so forcing viewport height just leaves blank space past the thread/composer.
    <section className="lg:h-full px-4 sm:px-6 lg:px-6 pt-2 pb-4">
      <div className="mx-auto lg:h-full w-full max-w-[2160px]">
        <MobileRecentDrawer />
        <CasesShell>{children}</CasesShell>
      </div>
    </section>
  )
}

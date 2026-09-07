import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySessionToken } from '@/lib/portal-auth'
import PortalHeader from '@/components/PortalHeader'
import TelemetryProvider from '@/components/TelemetryProvider'

export default async function PortalAuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal-session')?.value

  if (!token) {
    redirect('/portal/login')
  }

  const session = await verifySessionToken(token)
  if (!session) {
    redirect('/portal/login')
  }

  return (
    // Mobile: natural page scroll (one scrollbar) — the header/toolbars are sticky
    // in the window, matching CaseList's window.scrollY logic. Desktop: a fixed
    // h-dvh shell whose <main> scrolls internally so the split panes can too.
    // A single h-dvh+overflow-hidden shell on mobile fought the body scroll and
    // produced two scrollbars (100dvh != the address-bar-adjusted viewport).
    <div className="flex min-h-dvh flex-col lg:h-dvh lg:overflow-hidden">
      <TelemetryProvider />
      <PortalHeader name={session.name} email={session.email} role={session.role} />
      <main className="flex-1 min-h-0 bg-slate-50 lg:overflow-y-auto">
        {children}
      </main>
    </div>
  )
}

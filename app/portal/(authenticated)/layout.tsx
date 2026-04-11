import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySessionToken } from '@/lib/portal-auth'
import PortalHeader from '@/components/PortalHeader'
import Footer from '@/components/Footer'

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
    <div className="min-h-screen flex flex-col">
      <PortalHeader name={session.name} email={session.email} role={session.role} />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  )
}

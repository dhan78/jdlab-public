import { cookies } from 'next/headers'
import { verifySessionToken } from '@/lib/portal-auth'
import Hero from '@/components/Hero'
import Services from '@/components/Services'
import Automation from '@/components/Automation'
import GlobalReach from '@/components/GlobalReach'
import Resources from '@/components/Resources'
import ContactForm from '@/components/ContactForm'
import PageBackground from '@/components/PageBackground'

export default async function PortalPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal-session')?.value
  const session = token ? await verifySessionToken(token) : null

  return (
    <div className="min-h-screen">
      <PageBackground />
      <Hero />
      <Services />
      <Automation />
      <GlobalReach />
      <Resources />
      <ContactForm
        initialName={session?.name ?? ''}
        initialEmail={session?.email ?? ''}
      />
    </div>
  )
}

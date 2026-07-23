import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySessionToken } from '@/lib/portal-auth'
import CaseThread from '@/components/CaseThread'

export const metadata = {
  title: 'Case — JD Dental Lab Portal',
}

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get('portal-session')?.value
  const session = token ? await verifySessionToken(token) : null

  if (!session) {
    redirect('/portal/login')
  }

  return (
    <CaseThread
      caseId={id}
      currentUserId={session.sub}
      currentUserRole={session.role}
    />
  )
}

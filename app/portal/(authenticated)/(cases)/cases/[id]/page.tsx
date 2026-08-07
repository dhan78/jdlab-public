import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { verifySessionToken } from '@/lib/portal-auth'
import { findCaseById } from '@/lib/case-store'
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

  // Resolve the case up front so a mistyped/deleted/forbidden id renders our
  // friendly not-found panel (HTTP 404) instead of a red client-side error.
  // We return 404 for "no access" too (not 403) so we never leak to one doctor
  // that another doctor's case exists.
  const caseRow = await findCaseById(id)
  const canAccess =
    !!caseRow && (session.role !== 'doctor' || session.sub === caseRow.doctorId)
  if (!canAccess) {
    notFound()
  }

  return (
    <CaseThread
      caseId={id}
      currentUserId={session.sub}
      currentUserRole={session.role}
    />
  )
}

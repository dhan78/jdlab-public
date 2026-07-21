import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySessionToken } from '@/lib/portal-auth'
import { findDoctorById } from '@/lib/portal-store'
import AddressBook from '@/components/AddressBook'

export const metadata = {
  title: 'My Profile — JD Dental Lab Portal',
}

export default async function PortalProfilePage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal-session')?.value
  if (!token) redirect('/portal/login')

  const session = await verifySessionToken(token)
  if (!session) redirect('/portal/login')

  const doctor = await findDoctorById(session.sub)

  const detail = (label: string, value?: string) => (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-800 mt-0.5">{value || <span className="text-gray-400">—</span>}</dd>
    </div>
  )

  return (
    <section className="section-padding">
      <div className="container-wide max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">My Profile</h1>
          <p className="text-gray-500">Your account details and practice addresses.</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 space-y-8">
          <section aria-labelledby="account-heading">
            <h2 id="account-heading" className="text-xl font-bold text-gray-800 mb-4">Account</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {detail('Name', doctor?.name ?? session.name)}
              {detail('Email', doctor?.email ?? session.email)}
              {detail('Phone', doctor?.phone)}
              {detail('Practice Name', doctor?.practiceName)}
            </dl>
            <p className="text-xs text-gray-400 mt-3">
              To change your name, email, or password, please contact your lab administrator.
            </p>
          </section>

          <section aria-labelledby="addresses-heading">
            <h2 id="addresses-heading" className="text-xl font-bold text-gray-800 mb-1">Practice / Ship-to Addresses</h2>
            <p className="text-sm text-gray-500 mb-4">
              Add the locations you work from. Your preferred address is used as the default ship-to when you create a case.
            </p>
            <AddressBook doctorId={session.sub} />
          </section>
        </div>
      </div>
    </section>
  )
}

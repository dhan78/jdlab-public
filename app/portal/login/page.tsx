import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Logo from '@/components/Logo'
import PortalLoginForm from '@/components/PortalLoginForm'
import { verifySessionToken } from '@/lib/portal-auth'

export const metadata = {
  title: 'Doctor Portal Login — JD Dental Lab',
}

export default async function PortalLoginPage() {
  // Already signed in? Skip the login form and go straight to the cases list,
  // so clicking "Doctor Login" during an active session lands on the portal.
  const token = (await cookies()).get('portal-session')?.value
  if (token && (await verifySessionToken(token))) {
    redirect('/portal')
  }

  return (
    <div className="min-h-screen bg-light flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Logo />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Doctor Portal</h1>
          <p className="text-gray-500 text-sm mt-1">Sign in to access your portal</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <Suspense>
            <PortalLoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

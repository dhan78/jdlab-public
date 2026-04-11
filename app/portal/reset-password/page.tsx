import { Suspense } from 'react'
import Logo from '@/components/Logo'
import PortalResetPasswordForm from '@/components/PortalResetPasswordForm'

export const metadata = {
  title: 'Reset Password — JD Dental Lab Portal',
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-light flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Logo />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Set New Password</h1>
          <p className="text-gray-500 text-sm mt-1">Enter your new password below</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <Suspense>
            <PortalResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

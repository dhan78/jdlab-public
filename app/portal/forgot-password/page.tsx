import Logo from '@/components/Logo'
import PortalForgotPasswordForm from '@/components/PortalForgotPasswordForm'

export const metadata = {
  title: 'Forgot Password — JD Dental Lab Portal',
}

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen bg-light flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Logo />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Forgot Password</h1>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <PortalForgotPasswordForm />
        </div>
      </div>
    </div>
  )
}

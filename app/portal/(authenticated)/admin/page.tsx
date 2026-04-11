import PortalAdminForm from '@/components/PortalAdminForm'

export const metadata = {
  title: 'Admin — JD Dental Lab Portal',
}

export default function PortalAdminPage() {
  return (
    <section className="section-padding">
      <div className="container-wide">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Doctor Account Management</h1>
          <p className="text-gray-500">Add and manage doctor portal accounts.</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <PortalAdminForm />
        </div>
      </div>
    </section>
  )
}

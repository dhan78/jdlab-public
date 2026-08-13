import PortalAdminForm from '@/components/PortalAdminForm'
import SlaSettingsForm from '@/components/SlaSettingsForm'
import DemoSettingsForm from '@/components/DemoSettingsForm'
import PracticeMapForm from '@/components/PracticeMapForm'
import AdminImageUploader from '@/components/AdminImageUploader'
import AdminShell, { type AdminSection } from '@/components/AdminShell'

export const metadata = {
  title: 'Admin — JD Dental Lab Portal',
}

const icon = (path: string) => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    {path.split('|').map((d, i) => (
      <path key={i} d={d} strokeLinecap="round" strokeLinejoin="round" />
    ))}
  </svg>
)

const sections: AdminSection[] = [
  {
    key: 'doctors',
    label: 'Doctors',
    title: 'Doctor Account Management',
    description: 'Add and manage doctor portal accounts.',
    icon: icon('M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1|M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z|M17 11l2 2 4-4'),
    content: <PortalAdminForm />,
  },
  {
    key: 'sla',
    label: 'Turnaround / SLA',
    title: 'Turnaround / SLA',
    description: 'Set the promised turnaround (business days) per case type.',
    icon: icon('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z|M12 7v5l3 2'),
    content: <SlaSettingsForm />,
  },
  {
    key: 'demo',
    label: 'Public demo case',
    title: 'Public demo case',
    description: 'Publish one anonymized case as a read-only 3D preview for meetups/QR codes.',
    icon: icon('M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z|M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'),
    content: <DemoSettingsForm />,
  },
  {
    key: 'ingestion',
    label: 'Scan routing',
    title: 'Scan ingestion — practice routing',
    description: "Map each practice's source key to a doctor so incoming scans auto-assign.",
    icon: icon('M6 3v12|M18 9v12|M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z|M18 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z|M6 15a9 9 0 0 1 9-9h3'),
    content: <PracticeMapForm />,
  },
  {
    key: 'images',
    label: 'Marketing images',
    title: 'Marketing images',
    description: 'Drag & drop lab photos — auto-resized/compressed in the browser and saved to public/images (run locally, then commit).',
    icon: icon('M4 5h16v14H4z|M4 15l4-4 4 4 3-3 5 5|M9 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z'),
    content: <AdminImageUploader />,
  },
]

export default function PortalAdminPage() {
  return (
    <section className="section-padding">
      <div className="container-wide">
        <AdminShell
          sections={sections}
          links={[
            {
              label: 'Session Timeline',
              href: '/portal/admin/telemetry',
              icon: icon('M3 3v18h18|M7 14l4-4 3 3 5-6'),
            },
          ]}
        />
      </div>
    </section>
  )
}

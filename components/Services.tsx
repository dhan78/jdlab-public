import type { ReactNode } from 'react'

type ServiceIcon = 'crown' | 'implant' | 'cad' | 'print' | 'denture' | 'medical'

// Inline line icons (no external icon library — consistent with the portal's approach).
function ServiceGlyph({ name, className = 'w-7 h-7' }: { name: ServiceIcon; className?: string }) {
  const svg = (children: ReactNode) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
  switch (name) {
    case 'crown':
      return svg(
        <path d="M12 3c-1.8 0-2.6.9-4 .9S5.4 3 4.5 4.2C3.4 5.7 3.7 8.4 4.4 11c.7 2.6.9 8 2.3 8 1.1 0 .9-3.6 1.7-5.6.3-.7.7-1.1 1.6-1.1s1.3.4 1.6 1.1c.8 2 .6 5.6 1.7 5.6 1.4 0 1.6-5.4 2.3-8 .7-2.6 1-5.3-.1-6.8C18.6 3 17.8 3.9 16 3.9S13.8 3 12 3z" />
      )
    case 'implant':
      return svg(
        <>
          <path d="M12 2.5l2.5 2.5H9.5L12 2.5z" />
          <path d="M9.5 5h5M9 8h6M9.5 11h5M10 14h4M10.5 17h3l-1.5 4-1.5-4z" />
        </>
      )
    case 'cad':
      return svg(
        <>
          <path d="M12 2.8 4 7v10l8 4.2 8-4.2V7l-8-4.2z" />
          <path d="M4 7l8 4.2M20 7l-8 4.2M12 21.2V11.2" />
        </>
      )
    case 'print':
      return svg(
        <>
          <path d="M12 3 3.5 7.2 12 11.5l8.5-4.3L12 3z" />
          <path d="M3.5 12 12 16.3 20.5 12M3.5 16.8 12 21l8.5-4.2" />
        </>
      )
    case 'denture':
      return svg(
        <path d="M4 9c0-1.2 1.2-2 4-2s3 1.2 4 1.2S15.2 7 16 7c2.8 0 4 .8 4 2 0 3.5-1 8-2.6 8-1.2 0-1-3-2.4-3S12 17 12 17s-.6-3-2-3-1.2 3-2.4 3C6 17 4 12.5 4 9z" />
      )
    case 'medical':
      return svg(
        <>
          <path d="M9.5 3h5M10.5 3v4.5L5.7 16A2 2 0 0 0 7.5 19h9a2 2 0 0 0 1.8-3l-4.8-8.5V3" />
          <path d="M8.5 14h7" />
        </>
      )
  }
}

export default function Services() {
  const services: { icon: ServiceIcon; title: string; description: string; tint: string }[] = [
    {
      icon: 'crown',
      title: 'Crowns & Bridges',
      description: 'Precision-milled all-ceramic and metal-supported crowns with exceptional fit and aesthetics.',
      tint: 'bg-primary/10 text-primary',
    },
    {
      icon: 'implant',
      title: 'Implant Solutions',
      description: 'Complete implant workflows including abutments, crowns, and complex anatomical cases.',
      tint: 'bg-secondary/10 text-secondary',
    },
    {
      icon: 'cad',
      title: 'CAD/CAM Design',
      description: 'Advanced digital design services with state-of-the-art milling and 3D printing capabilities.',
      tint: 'bg-accent/10 text-accent',
    },
    {
      icon: 'print',
      title: '3D Printing',
      description: 'High-precision 3D printing for models, surgical guides, and final restorations.',
      tint: 'bg-primary/10 text-primary',
    },
    {
      icon: 'denture',
      title: 'Dentures & Partials',
      description: 'Digital design and manufacturing of complete and partial denture solutions.',
      tint: 'bg-secondary/10 text-secondary',
    },
    {
      icon: 'medical',
      title: 'Medical Devices',
      description: 'Custom fabrication of specialized medical and surgical devices.',
      tint: 'bg-accent/10 text-accent',
    },
  ]

  return (
    <section id="services" className="section-padding bg-light scroll-mt-20">
      <div className="container-wide">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Our Services</h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Comprehensive dental and medical device solutions powered by digital technology
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((service, index) => (
            <div
              key={index}
              className="bg-white p-8 rounded-2xl shadow-sm ring-1 ring-gray-100 hover:shadow-lg motion-safe:hover:-translate-y-0.5 transition-all"
            >
              <div className={`inline-flex items-center justify-center w-14 h-14 rounded-xl mb-5 ${service.tint}`}>
                <ServiceGlyph name={service.icon} className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold mb-2">{service.title}</h3>
              <p className="text-gray-600">{service.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

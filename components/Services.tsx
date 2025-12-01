export default function Services() {
  const services = [
    {
      icon: '🦷',
      title: 'Crowns & Bridges',
      description: 'Precision-milled all-ceramic and metal-supported crowns with exceptional fit and aesthetics.'
    },
    {
      icon: '🔧',
      title: 'Implant Solutions',
      description: 'Complete implant workflows including abutments, crowns, and complex anatomical cases.'
    },
    {
      icon: '📐',
      title: 'CAD/CAM Design',
      description: 'Advanced digital design services with state-of-the-art milling and 3D printing capabilities.'
    },
    {
      icon: '🖨️',
      title: '3D Printing',
      description: 'High-precision 3D printing for models, surgical guides, and final restorations.'
    },
    {
      icon: '✨',
      title: 'Dentures & Partials',
      description: 'Digital design and manufacturing of complete and partial denture solutions.'
    },
    {
      icon: '🔬',
      title: 'Medical Devices',
      description: 'Custom fabrication of specialized medical and surgical devices.'
    }
  ]

  return (
    <section id="services" className="section-padding bg-light">
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
              className="bg-white p-8 rounded-lg shadow-md hover:shadow-lg transition-shadow"
            >
              <div className="text-5xl mb-4">{service.icon}</div>
              <h3 className="text-xl font-bold mb-2">{service.title}</h3>
              <p className="text-gray-600">{service.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

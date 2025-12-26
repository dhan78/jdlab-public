export default function Resources() {
  const resourceLinks = [
    {
      emoji: '📸',
      title: 'Upload Case Photos',
      description: 'Submit high-resolution images of your cases for our review',
      href: '/upload',
      color: 'bg-cyan-50 hover:bg-cyan-100 border-cyan-200'
    },
    {
      emoji: '📡',
      title: 'Send Digital Scans',
      description: 'Connect your scanner to submit digital impressions directly to our lab',
      href: '/scans',
      color: 'bg-cyan-50 hover:bg-cyan-100 border-cyan-200'
    },
    {
      emoji: '📄',
      title: 'Articles',
      description: 'Industry insights, case studies, and technical documentation',
      href: '/articles',
      color: 'bg-white hover:bg-gray-50 border-gray-200'
    },
    {
      emoji: '🔬',
      title: 'IOS Guidance & Techniques',
      description: 'Best practices for intraoral scanning and digital workflows',
      href: '/ios-guidance',
      color: 'bg-white hover:bg-gray-50 border-gray-200'
    },
    {
      emoji: '🎓',
      title: 'Continuing Education Events',
      description: 'Webinars, workshops, and training sessions for dental professionals',
      href: '/education',
      color: 'bg-white hover:bg-gray-50 border-gray-200'
    },
    {
      emoji: '🤝',
      title: 'Lab to Lab Outsourcing',
      description: 'Partner with us for overflow work and specialized services',
      href: '/outsourcing',
      color: 'bg-white hover:bg-gray-50 border-gray-200'
    }
  ]

  return (
    <section id="resources" className="section-padding bg-light">
      <div className="container-wide">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">Resources & Tools</h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Access our digital tools, educational content, and professional resources to streamline your workflow
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {resourceLinks.map((resource, index) => (
            <a
              key={index}
              href={resource.href}
              className={`block p-6 rounded-lg border-2 transition-all ${resource.color}`}
            >
              <div className="flex items-start gap-4">
                <div className="text-4xl flex-shrink-0">{resource.emoji}</div>
                <div>
                  <h3 className="text-lg font-bold text-primary mb-2 uppercase tracking-wide">
                    {resource.title}
                  </h3>
                  <p className="text-gray-600 text-sm">
                    {resource.description}
                  </p>
                </div>
              </div>
            </a>
          ))}
        </div>

        <div className="mt-12 text-center bg-white p-8 rounded-lg shadow-md">
          <h3 className="text-2xl font-bold mb-4">Need Technical Support?</h3>
          <p className="text-gray-600 mb-6">
            Our team is available 24/7 to assist with case submissions, technical questions, and workflow optimization
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="#contact" className="btn-primary">
              Contact Support
            </a>
            <a href="/faq" className="btn-secondary">
              View FAQ
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

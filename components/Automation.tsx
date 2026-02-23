export default function Automation() {
  const workflows = [
    {
      step: 1,
      title: 'Digital Impression Upload',
      description: 'Dentists securely upload digital scans and case specifications through our platform.'
    },
    {
      step: 2,
      title: 'AI-Powered Analysis',
      description: 'Automated systems analyze cases and suggest optimal materials and designs.'
    },
    {
      step: 3,
      title: 'Digital Design',
      description: 'Expert technicians refine designs with precision CAD/CAM software.'
    },
    {
      step: 4,
      title: 'Automated Manufacturing',
      description: 'CNC mills and 3D printers automatically process designs with zero-error precision.'
    },
    {
      step: 5,
      title: 'Quality Assurance',
      description: 'Automated QA systems verify specifications before final finishing.'
    },
    {
      step: 6,
      title: 'Real-time Tracking',
      description: 'Dentists track order status in real-time through our digital platform.'
    }
  ]

  return (
    <section id="automation" className="section-padding bg-white scroll-mt-20">
      <div className="container-wide">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Workflow Automation</h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Streamlined automated processes from case intake to delivery for maximum efficiency and consistency
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {workflows.map((workflow) => (
            <div key={workflow.step} className="bg-light p-8 rounded-lg border-l-4 border-primary hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary text-white font-bold">
                    {workflow.step}
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-dark mb-2">{workflow.title}</h3>
                  <p className="text-gray-600">{workflow.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-gradient-to-r from-primary to-secondary text-white p-8 rounded-lg text-center">
          <h3 className="text-2xl font-bold mb-4">Average Case Turnaround: 24-48 Hours</h3>
          <p className="text-lg max-w-2xl mx-auto">
            Our fully automated workflow processes cases at machine speed while maintaining 99.8% quality accuracy.
            Serve your patients faster without compromising on quality.
          </p>
        </div>
      </div>
    </section>
  )
}

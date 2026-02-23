export default function GlobalReach() {
  const regions = [
    {
      continent: 'North America',
      countries: 'USA, Canada, Mexico',
      icon: '🌎',
      facilities: 3,
      partnerships: '500+'
    },
    {
      continent: 'Europe',
      countries: 'Germany, UK, France, Spain, Italy',
      icon: '🌍',
      facilities: 5,
      partnerships: '800+'
    },
    {
      continent: 'Asia Pacific',
      countries: 'Australia, Japan, Singapore, India',
      icon: '🌏',
      facilities: 4,
      partnerships: '650+'
    },
    {
      continent: 'Middle East & Africa',
      countries: 'UAE, Saudi Arabia, South Africa',
      icon: '🌍',
      facilities: 2,
      partnerships: '300+'
    }
  ]

  return (
    <section id="global" className="section-padding bg-light scroll-mt-20">
      <div className="container-wide">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Global Reach</h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Operating worldwide with strategic facilities and partnerships on every continent
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {regions.map((region, index) => (
            <div key={index} className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-4">{region.icon}</div>
              <h3 className="text-xl font-bold mb-2 text-primary">{region.continent}</h3>
              <div className="space-y-2 text-sm text-gray-600 mb-4">
                <p><strong>Countries:</strong> {region.countries}</p>
                <p><strong>Facilities:</strong> {region.facilities}</p>
                <p className="text-secondary"><strong>{region.partnerships}</strong> dental partners</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 bg-white p-8 rounded-lg">
          <div className="text-center">
            <div className="text-4xl font-bold text-primary mb-2">14</div>
            <p className="text-gray-600">Countries Served</p>
          </div>
          <div className="text-center border-l border-r border-gray-200">
            <div className="text-4xl font-bold text-secondary mb-2">2,300+</div>
            <p className="text-gray-600">Active Dental Partners</p>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-accent mb-2">50K+</div>
            <p className="text-gray-600">Cases Completed Yearly</p>
          </div>
        </div>

        <div className="mt-12 bg-gradient-to-r from-primary/10 to-secondary/10 p-8 rounded-lg border border-primary/20">
          <h3 className="text-2xl font-bold mb-4">Worldwide Same-Day Delivery Network</h3>
          <p className="text-gray-600 mb-4">
            With strategic distribution centers on every continent and partnerships with leading logistics providers, 
            we ensure your cases arrive on time, every time. Track shipments in real-time through our platform.
          </p>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <li className="flex items-center gap-2">
              <span className="text-secondary">✓</span> Express shipping options available
            </li>
            <li className="flex items-center gap-2">
              <span className="text-secondary">✓</span> Temperature-controlled logistics
            </li>
            <li className="flex items-center gap-2">
              <span className="text-secondary">✓</span> Full tracking & insurance
            </li>
            <li className="flex items-center gap-2">
              <span className="text-secondary">✓</span> Customs clearance handled
            </li>
          </ul>
        </div>
      </div>
    </section>
  )
}

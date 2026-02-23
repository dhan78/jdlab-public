import Header from '@/components/Header'
import Footer from '@/components/Footer'
import PageBackground from '@/components/PageBackground'
import Link from 'next/link'

export default function ArticlesPage() {
  const articles = [
    {
      emoji: '🔬',
      category: 'Technology',
      title: 'The Future of Digital Dentistry: IOS Scanners vs Traditional Impressions',
      excerpt: 'Explore how intraoral scanners are revolutionizing dental workflows with improved accuracy, faster turnaround times, and better patient experiences.',
      date: 'December 20, 2024',
      readTime: '5 min read'
    },
    {
      emoji: '🎯',
      category: 'Best Practices',
      title: 'Achieving Perfect Margins: Digital Design Tips for Crown & Bridge',
      excerpt: 'Learn the key techniques for designing precise crown and bridge restorations using CAD/CAM technology for optimal fit and longevity.',
      date: 'December 15, 2024',
      readTime: '7 min read'
    },
    {
      emoji: '🦷',
      category: 'Implants',
      title: 'Guided Surgery Planning: From Scan to Surgical Guide',
      excerpt: 'A comprehensive guide to creating accurate surgical guides for dental implants using digital planning workflows and 3D printing.',
      date: 'December 10, 2024',
      readTime: '8 min read'
    },
    {
      emoji: '💡',
      category: 'Workflow',
      title: 'Optimizing Your Lab-to-Practice Communication',
      excerpt: 'Discover strategies for seamless collaboration between dental practices and labs through digital case submission and real-time tracking.',
      date: 'December 5, 2024',
      readTime: '6 min read'
    },
    {
      emoji: '🏥',
      category: 'Medical Devices',
      title: 'Custom Medical Device Manufacturing: Quality Standards & Compliance',
      excerpt: 'Understanding the regulatory requirements and quality control processes for producing medical-grade dental and orthotic devices.',
      date: 'November 30, 2024',
      readTime: '10 min read'
    },
    {
      emoji: '🎨',
      title: 'Material Selection Guide: Zirconia vs Lithium Disilicate',
      category: 'Materials',
      excerpt: 'Compare the properties, indications, and aesthetic outcomes of modern ceramic materials for different clinical situations.',
      date: 'November 25, 2024',
      readTime: '6 min read'
    },
    {
      emoji: '📊',
      category: 'Case Studies',
      title: 'Full-Arch Restoration: A Digital Workflow Success Story',
      excerpt: 'Step-by-step breakdown of a complete digital workflow for full-arch implant-supported restoration from initial scan to final delivery.',
      date: 'November 20, 2024',
      readTime: '12 min read'
    },
    {
      emoji: '⚡',
      category: 'Efficiency',
      title: 'Reducing Turnaround Time: 5 Strategies That Work',
      excerpt: 'Practical tips for speeding up case processing without compromising quality, from scan optimization to automation tools.',
      date: 'November 15, 2024',
      readTime: '5 min read'
    },
    {
      emoji: '🔧',
      category: 'Troubleshooting',
      title: 'Common Scanning Errors and How to Fix Them',
      excerpt: 'Identify and resolve the most frequent issues with intraoral scanning including motion artifacts, missing data, and color accuracy.',
      date: 'November 10, 2024',
      readTime: '8 min read'
    }
  ]

  return (
    <div className="min-h-screen">
      <PageBackground />
      <Header />

      {/* Hero Section */}
      <section className="section-padding bg-gradient-to-b from-primary/10 to-white">
        <div className="container-wide">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-5xl font-bold mb-6">
              Articles & Resources
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Industry insights, technical guides, and best practices for modern dental professionals
            </p>
          </div>
        </div>
      </section>

      {/* Articles Grid */}
      <section className="section-padding bg-white">
        <div className="container-wide">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {articles.map((article, index) => {
              const articleLinks = [
                '/articles/digital-dentistry-future',
                '/articles/crown-bridge-margins',
                '/articles/implant-planning',
                '/articles/lab-communication',
                '/articles/medical-devices',
                '/articles/material-selection',
                '/articles/full-arch-workflow',
                '/articles/turnaround-time',
                '/articles/scanning-errors'
              ]
              const href = articleLinks[index] || '#'
              return (
              <Link key={index} href={href} className="block bg-light rounded-lg overflow-hidden hover:shadow-xl transition-shadow cursor-pointer">
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-4xl">{article.emoji}</span>
                    <span className="inline-block px-3 py-1 bg-primary/10 text-primary text-sm font-semibold rounded-full">
                      {article.category}
                    </span>
                  </div>
                  
                  <h3 className="text-xl font-bold mb-3 line-clamp-2">
                    {article.title}
                  </h3>
                  
                  <p className="text-gray-600 mb-4 line-clamp-3">
                    {article.excerpt}
                  </p>
                  
                  <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                    <span>{article.date}</span>
                    <span>{article.readTime}</span>
                  </div>
                  
                  <span className="text-primary font-semibold hover:text-blue-700 transition-colors">
                    Read Article →
                  </span>
                </div>
              </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* Newsletter Signup */}
      <section className="section-padding bg-light">
        <div className="container-wide max-w-2xl">
          <div className="bg-white p-8 rounded-lg text-center">
            <h2 className="text-3xl font-bold mb-4">Stay Updated</h2>
            <p className="text-gray-600 mb-6">
              Subscribe to our newsletter for the latest articles, industry news, and digital dentistry tips
            </p>
            <form className="flex flex-col sm:flex-row gap-4">
              <input
                type="email"
                placeholder="Enter your email"
                required
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-primary"
              />
              <button type="submit" className="btn-primary whitespace-nowrap">
                Subscribe
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Related Resources */}
      <section className="section-padding bg-white">
        <div className="container-wide">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Explore More Resources</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Link href="/ios-leasing" className="bg-light p-6 rounded-lg hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-4">🔬</div>
              <h3 className="text-xl font-bold mb-2">IOS Scanner Leasing</h3>
              <p className="text-gray-600 mb-4">
                Learn about our scanner leasing program and digitize your workflow
              </p>
              <span className="text-primary font-semibold">Learn More →</span>
            </Link>

            <Link href="/scans" className="bg-light p-6 rounded-lg hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-4">📡</div>
              <h3 className="text-xl font-bold mb-2">Send Digital Scans</h3>
              <p className="text-gray-600 mb-4">
                Step-by-step guides for all major scanner systems
              </p>
              <span className="text-primary font-semibold">View Guides →</span>
            </Link>

            <Link href="/#contact" className="bg-light p-6 rounded-lg hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-4">💬</div>
              <h3 className="text-xl font-bold mb-2">Contact Support</h3>
              <p className="text-gray-600 mb-4">
                Get expert advice from our technical team
              </p>
              <span className="text-primary font-semibold">Get Help →</span>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}

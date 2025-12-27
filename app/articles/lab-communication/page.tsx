import Header from '@/components/Header'
import Footer from '@/components/Footer'
import PageBackground from '@/components/PageBackground'
import Link from 'next/link'

export default function LabCommunicationArticle() {
  return (
    <div className="min-h-screen">
      <PageBackground />
      <Header />

      <article className="section-padding bg-white">
        <div className="container-wide max-w-4xl">
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-5xl">💡</span>
              <span className="inline-block px-4 py-2 bg-primary/10 text-primary text-sm font-bold rounded-full uppercase tracking-wide">
                Workflow
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              Optimizing Your Lab-to-Practice Communication
            </h1>
            <div className="flex items-center gap-6 text-gray-600 mb-6">
              <span>📅 December 5, 2024</span>
              <span>⏱️ 6 min read</span>
            </div>
            <p className="text-xl text-gray-700 leading-relaxed">
              Seamless communication between dental practices and labs is the foundation of successful restorations. Discover strategies for clear case submission, efficient problem-solving, and building lasting partnerships.
            </p>
          </div>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6">Essential Communication Elements</h2>
            <div className="space-y-6">
              <div className="bg-light p-6 rounded-lg border-l-4 border-primary">
                <h3 className="text-xl font-bold mb-3">Clear Case Prescriptions</h3>
                <p className="text-gray-700 mb-3">Every case should include:</p>
                <ul className="space-y-2 text-gray-700 ml-6">
                  <li>• Tooth number and restoration type clearly specified</li>
                  <li>• Material selection with shade information</li>
                  <li>• Desired delivery date with rush status if applicable</li>
                  <li>• Special instructions (contacts, anatomy preferences)</li>
                  <li>• Photos showing shade, existing dentition, bite</li>
                </ul>
              </div>

              <div className="bg-light p-6 rounded-lg border-l-4 border-secondary">
                <h3 className="text-xl font-bold mb-3">Digital Submission Best Practices</h3>
                <p className="text-gray-700 mb-3">When sending digital scans:</p>
                <ul className="space-y-2 text-gray-700 ml-6">
                  <li>• Verify scan completeness before submitting</li>
                  <li>• Include opposing arch and bite registration</li>
                  <li>• Submit photos separately for shade/contour reference</li>
                  <li>• Use lab's preferred file format and portal</li>
                  <li>• Confirm receipt within 24 hours</li>
                </ul>
              </div>

              <div className="bg-light p-6 rounded-lg border-l-4 border-accent">
                <h3 className="text-xl font-bold mb-3">Proactive Problem Resolution</h3>
                <p className="text-gray-700 mb-3">Address issues immediately:</p>
                <ul className="space-y-2 text-gray-700 ml-6">
                  <li>• Lab contacts practice within hours if scan issues detected</li>
                  <li>• Practice responds promptly to lab inquiries</li>
                  <li>• Both parties document agreed-upon solutions</li>
                  <li>• Photos/scans shared for clarification when needed</li>
                  <li>• Follow-up confirms issue resolution</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6">Common Communication Pitfalls</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-bold mb-2 text-accent">❌ Incomplete Information</h3>
                <p className="text-gray-700 text-sm">
                  Missing shade, material, or delivery date delays production and requires follow-up calls.
                </p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-bold mb-2 text-accent">❌ Unrealistic Timelines</h3>
                <p className="text-gray-700 text-sm">
                  Expecting 24-hour turnaround without rush designation causes frustration and errors.
                </p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-bold mb-2 text-accent">❌ Poor Photo Quality</h3>
                <p className="text-gray-700 text-sm">
                  Blurry, poorly lit shade photos make color matching nearly impossible.
                </p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-bold mb-2 text-accent">❌ Last-Minute Changes</h3>
                <p className="text-gray-700 text-sm">
                  Modifying cases after production starts causes delays and potential remakes.
                </p>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <div className="bg-gradient-to-r from-primary to-secondary text-white p-8 rounded-lg">
              <h2 className="text-3xl font-bold mb-4">Keys to Successful Partnership</h2>
              <ul className="space-y-3 text-lg">
                <li className="flex items-start gap-3">
                  <span>✓</span>
                  <span>Establish single point of contact at practice and lab</span>
                </li>
                <li className="flex items-start gap-3">
                  <span>✓</span>
                  <span>Schedule regular check-ins to review cases and processes</span>
                </li>
                <li className="flex items-start gap-3">
                  <span>✓</span>
                  <span>Provide constructive feedback on completed restorations</span>
                </li>
                <li className="flex items-start gap-3">
                  <span>✓</span>
                  <span>Use digital tracking portals for real-time case status</span>
                </li>
              </ul>
            </div>
          </section>

          <section className="bg-light p-8 rounded-lg text-center">
            <h3 className="text-2xl font-bold mb-4">Experience Seamless Communication</h3>
            <p className="text-gray-700 mb-6">
              Our digital platform provides 24/7 case tracking and direct technician access
            </p>
            <Link href="/#contact" className="btn-primary inline-block">
              Become a Partner Practice
            </Link>
          </section>

          <div className="mt-12 text-center">
            <Link href="/articles" className="text-primary font-semibold hover:underline">
              ← Back to All Articles
            </Link>
          </div>
        </div>
      </article>

      <Footer />
    </div>
  )
}

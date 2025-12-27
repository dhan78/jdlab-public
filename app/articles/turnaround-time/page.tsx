import Header from '@/components/Header'
import Footer from '@/components/Footer'
import PageBackground from '@/components/PageBackground'
import Link from 'next/link'

export default function TurnaroundTimeArticle() {
  return (
    <div className="min-h-screen">
      <PageBackground />
      <Header />

      <article className="section-padding bg-white">
        <div className="container-wide max-w-4xl">
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-5xl">⚡</span>
              <span className="inline-block px-4 py-2 bg-primary/10 text-primary text-sm font-bold rounded-full uppercase tracking-wide">
                Efficiency
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              Reducing Turnaround Time: 5 Strategies That Work
            </h1>
            <div className="flex items-center gap-6 text-gray-600 mb-6">
              <span>📅 December 1, 2024</span>
              <span>⏱️ 5 min read</span>
            </div>
            <p className="text-xl text-gray-700 leading-relaxed">
              Fast turnaround times improve patient satisfaction and practice productivity. Discover proven strategies to minimize case completion time without sacrificing quality.
            </p>
          </div>

          <section className="mb-12">
            <div className="bg-primary/10 p-8 rounded-lg border-l-4 border-primary">
              <h2 className="text-2xl font-bold mb-4">Industry Benchmarks</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-lg text-center">
                  <div className="text-4xl font-bold text-primary mb-2">3-5</div>
                  <p className="text-gray-700 font-semibold">Days</p>
                  <p className="text-sm text-gray-600 mt-2">Single crowns (digital)</p>
                </div>
                <div className="bg-white p-6 rounded-lg text-center">
                  <div className="text-4xl font-bold text-secondary mb-2">7-10</div>
                  <p className="text-gray-700 font-semibold">Days</p>
                  <p className="text-sm text-gray-600 mt-2">Multi-unit bridges</p>
                </div>
                <div className="bg-white p-6 rounded-lg text-center">
                  <div className="text-4xl font-bold text-accent mb-2">24</div>
                  <p className="text-gray-700 font-semibold">Hours</p>
                  <p className="text-sm text-gray-600 mt-2">Rush cases (available)</p>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6">Strategy 1: Submit Digital Impressions</h2>
            <div className="bg-light p-6 rounded-lg">
              <p className="text-gray-700 mb-4">
                Digital scans eliminate shipping delays and remake risk from damaged impressions.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-bold mb-3 text-primary">Traditional Workflow Timeline</h3>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li>• Day 1: Impression taken</li>
                    <li>• Day 2: Package shipped</li>
                    <li>• Day 3-4: Transit time</li>
                    <li>• Day 5: Lab receives, pours model</li>
                    <li>• Day 6: Design begins</li>
                    <li>• <strong>Total delay: 5 days before work starts</strong></li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-bold mb-3 text-secondary">Digital Workflow Timeline</h3>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li>• Day 1: Scan completed</li>
                    <li>• Day 1: Files uploaded to portal</li>
                    <li>• Day 1: Lab receives notification</li>
                    <li>• Day 1: Quality check completed</li>
                    <li>• Day 2: Design begins</li>
                    <li>• <strong>Total delay: 1 day, 4 days saved</strong></li>
                  </ul>
                </div>
              </div>
              <div className="mt-6 bg-white p-4 rounded">
                <p className="font-semibold text-primary mb-2">💡 Quick Win:</p>
                <p className="text-gray-700 text-sm">
                  Submit scans before noon for same-day design start. Most labs process morning submissions by afternoon.
                </p>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6">Strategy 2: Provide Complete Information Upfront</h2>
            <div className="bg-light p-6 rounded-lg">
              <p className="text-gray-700 mb-4">
                Incomplete case prescriptions cause delays while lab contacts practice for clarification.
              </p>
              <div className="space-y-4">
                <div className="bg-accent/10 p-4 rounded border-l-4 border-accent">
                  <h3 className="font-bold mb-2">Common Information Gaps</h3>
                  <ul className="space-y-1 text-sm text-gray-700">
                    <li>❌ Missing shade information → 1-2 day delay</li>
                    <li>❌ Unclear material selection → 1 day delay</li>
                    <li>❌ No bite registration → 2-3 day delay (need rescan)</li>
                    <li>❌ Ambiguous delivery date → Scheduling conflicts</li>
                  </ul>
                </div>
                <div className="bg-primary/5 p-4 rounded border-l-4 border-primary">
                  <h3 className="font-bold mb-2">Complete Submission Checklist</h3>
                  <ul className="space-y-1 text-sm text-gray-700">
                    <li>✓ Patient name, tooth number, restoration type</li>
                    <li>✓ Material specified (zirconia, e.max, etc.)</li>
                    <li>✓ Shade with value (A2, not just "match adjacent")</li>
                    <li>✓ Desired delivery date clearly stated</li>
                    <li>✓ Photos included (especially for anterior)</li>
                    <li>✓ Special instructions (contacts, anatomy)</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6">Strategy 3: Use Standardized Materials</h2>
            <div className="bg-light p-6 rounded-lg">
              <p className="text-gray-700 mb-4">
                Labs optimize workflows around commonly used materials with predictable processing.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded shadow-md">
                  <h3 className="font-bold mb-3 text-secondary">Fast-Track Materials</h3>
                  <p className="text-sm text-gray-700 mb-3">Ready stock, established protocols:</p>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li>• <strong>Zirconia:</strong> 3Y-TZP monolithic (3-4 days)</li>
                    <li>• <strong>Lithium Disilicate:</strong> IPS e.max (4-5 days)</li>
                    <li>• <strong>PMMA:</strong> Provisionals (2-3 days)</li>
                  </ul>
                </div>
                <div className="bg-white p-6 rounded shadow-md">
                  <h3 className="font-bold mb-3 text-accent">Delayed Materials</h3>
                  <p className="text-sm text-gray-700 mb-3">Special order, longer processing:</p>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li>• <strong>PFM:</strong> Outdated, requires layering (7+ days)</li>
                    <li>• <strong>Specialty alloys:</strong> May need ordering (10+ days)</li>
                    <li>• <strong>Custom staining:</strong> Additional firing cycles (2+ days)</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6">Strategy 4: Establish Preferred Lab Partnership</h2>
            <div className="bg-light p-6 rounded-lg">
              <p className="text-gray-700 mb-4">
                Working consistently with one lab creates efficiency through familiarity and priority status.
              </p>
              <div className="space-y-4">
                <div className="bg-white p-6 rounded shadow-md">
                  <h3 className="font-bold mb-3">Partnership Benefits</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-primary font-semibold mb-2">For Practice</h4>
                      <ul className="space-y-1 text-sm text-gray-700">
                        <li>• Priority scheduling during busy periods</li>
                        <li>• Technician learns your preferences</li>
                        <li>• Reduced remakes (better communication)</li>
                        <li>• Volume discounts on pricing</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-secondary font-semibold mb-2">For Lab</h4>
                      <ul className="space-y-1 text-sm text-gray-700">
                        <li>• Predictable case flow for staffing</li>
                        <li>• Familiar with practice standards</li>
                        <li>• Fewer clarification calls needed</li>
                        <li>• Reliable payment processing</li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="bg-gradient-to-r from-primary to-secondary text-white p-6 rounded">
                  <p className="font-bold mb-2">⚡ Pro Tip:</p>
                  <p className="text-sm">
                    Schedule weekly "batch" submissions on same day (e.g., Mondays). Labs can coordinate fabrication schedules for simultaneous delivery.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6">Strategy 5: Communicate Urgency Appropriately</h2>
            <div className="bg-light p-6 rounded-lg">
              <p className="text-gray-700 mb-4">
                Reserve rush requests for true emergencies to maintain credibility and avoid surcharges.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left bg-white rounded-lg">
                  <thead>
                    <tr className="border-b-2 border-gray-300">
                      <th className="py-3 px-4 font-bold">Situation</th>
                      <th className="py-3 px-4 font-bold">Request Type</th>
                      <th className="py-3 px-4 font-bold">Timeline</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-200">
                      <td className="py-3 px-4">Routine single crown</td>
                      <td className="py-3 px-4">Standard</td>
                      <td className="py-3 px-4">5-7 business days</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="py-3 px-4">Patient traveling out of town</td>
                      <td className="py-3 px-4">Expedited</td>
                      <td className="py-3 px-4">3 business days</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="py-3 px-4">Broken temp, patient in pain</td>
                      <td className="py-3 px-4">Rush</td>
                      <td className="py-3 px-4">24-48 hours</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4">Wedding/special event</td>
                      <td className="py-3 px-4">Priority</td>
                      <td className="py-3 px-4">Coordinate with lab</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="mt-4 bg-accent/10 p-4 rounded">
                <p className="font-semibold mb-2">⚠️ Avoid "Boy Who Cried Wolf" Syndrome</p>
                <p className="text-gray-700 text-sm">
                  Practices that mark every case as urgent lose priority status. Labs prioritize based on true need and partnership history.
                </p>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <div className="bg-gradient-to-r from-primary to-secondary text-white p-8 rounded-lg">
              <h2 className="text-3xl font-bold mb-6">Turnaround Time Comparison</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-xl font-bold mb-4">Without Optimization</h3>
                  <ul className="space-y-2">
                    <li>• Traditional impressions: +3 days</li>
                    <li>• Missing information: +2 days</li>
                    <li>• Specialty materials: +2 days</li>
                    <li>• No lab relationship: +1 day</li>
                    <li className="pt-2 border-t border-white/30">
                      <strong>Total: 15+ days average</strong>
                    </li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-4">With All 5 Strategies</h3>
                  <ul className="space-y-2">
                    <li>• Digital submission: Day 1</li>
                    <li>• Complete info: No delays</li>
                    <li>• Standard materials: Optimized</li>
                    <li>• Partnership priority: Expedited</li>
                    <li className="pt-2 border-t border-white/30">
                      <strong>Total: 3-5 days average</strong>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="mt-6 text-center">
                <p className="text-2xl font-bold">⚡ 10-day improvement possible</p>
              </div>
            </div>
          </section>

          <section className="bg-light p-8 rounded-lg text-center">
            <h3 className="text-2xl font-bold mb-4">Experience Our Fast Turnaround</h3>
            <p className="text-gray-700 mb-6">
              Digital workflow + 24/7 production = industry-leading turnaround times
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/scans" className="btn-secondary inline-block">
                Set Up Digital Scanning
              </Link>
              <Link href="/#contact" className="btn-primary inline-block">
                Become a Partner
              </Link>
            </div>
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

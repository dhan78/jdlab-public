import Header from '@/components/Header'
import Footer from '@/components/Footer'
import PageBackground from '@/components/PageBackground'
import Link from 'next/link'

export default function ScanningErrorsArticle() {
  return (
    <div className="min-h-screen">
      <PageBackground />
      <Header />

      <article className="section-padding bg-white">
        <div className="container-wide max-w-4xl">
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-5xl">🔧</span>
              <span className="inline-block px-4 py-2 bg-secondary/10 text-secondary text-sm font-bold rounded-full uppercase tracking-wide">
                Troubleshooting
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              Common Scanning Errors and How to Fix Them
            </h1>
            <div className="flex items-center gap-6 text-gray-600 mb-6">
              <span>📅 November 30, 2024</span>
              <span>⏱️ 8 min read</span>
            </div>
            <p className="text-xl text-gray-700 leading-relaxed">
              Intraoral scanning errors waste chair time and delay case delivery. Learn to identify and correct the most common scanning mistakes before submitting to your lab.
            </p>
          </div>

          <section className="mb-12">
            <div className="bg-accent/10 p-8 rounded-lg border-l-4 border-accent">
              <h2 className="text-2xl font-bold mb-4">Why Scan Quality Matters</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-5xl mb-2">⏱️</div>
                  <p className="font-bold mb-1">2-3 Days Lost</p>
                  <p className="text-sm text-gray-700">Average delay from rescans</p>
                </div>
                <div className="text-center">
                  <div className="text-5xl mb-2">💰</div>
                  <p className="font-bold mb-1">$150-300</p>
                  <p className="text-sm text-gray-700">Cost of remake from bad scan</p>
                </div>
                <div className="text-center">
                  <div className="text-5xl mb-2">😟</div>
                  <p className="font-bold mb-1">Patient Frustration</p>
                  <p className="text-sm text-gray-700">Additional appointment needed</p>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6">Error 1: Incomplete Margin Capture</h2>
            <div className="bg-light p-6 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-xl font-bold mb-3 text-accent">Problem</h3>
                  <p className="text-gray-700 mb-3">
                    Preparation margins not fully captured, especially on lingual/palatal aspects or subgingival areas.
                  </p>
                  <div className="bg-white p-4 rounded">
                    <h4 className="font-semibold mb-2">Visual Indicators:</h4>
                    <ul className="space-y-1 text-sm text-gray-700">
                      <li>• Gray/fuzzy areas at margin</li>
                      <li>• Mesh "holes" in gingival area</li>
                      <li>• Discontinuous margin line</li>
                      <li>• Scanner freezes during capture</li>
                    </ul>
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-3 text-primary">Solution</h3>
                  <div className="space-y-3">
                    <div className="bg-white p-4 rounded">
                      <p className="font-semibold mb-2">Before Scanning:</p>
                      <ul className="space-y-1 text-sm text-gray-700">
                        <li>✓ Use retraction cord (double cord technique)</li>
                        <li>✓ Apply hemostatic agent if bleeding</li>
                        <li>✓ Dry tooth completely with air syringe</li>
                        <li>✓ Check prep with explorer for sharp lines</li>
                      </ul>
                    </div>
                    <div className="bg-white p-4 rounded">
                      <p className="font-semibold mb-2">During Scanning:</p>
                      <ul className="space-y-1 text-sm text-gray-700">
                        <li>✓ Angle scanner tip to "see" subgingival</li>
                        <li>✓ Make 3-4 passes around prep margin</li>
                        <li>✓ Scan from occlusal down to margin</li>
                        <li>✓ Verify margin capture before moving on</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6">Error 2: Motion Artifacts & Blurring</h2>
            <div className="bg-light p-6 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-xl font-bold mb-3 text-accent">Problem</h3>
                  <p className="text-gray-700 mb-3">
                    Scanner moved too quickly or patient moved during capture, causing distorted geometry.
                  </p>
                  <div className="bg-accent/10 p-4 rounded">
                    <h4 className="font-semibold mb-2">Causes:</h4>
                    <ul className="space-y-1 text-sm text-gray-700">
                      <li>• Scanner tip moved &gt; 2mm/second</li>
                      <li>• Patient swallowed or gagged</li>
                      <li>• Inadequate patient stabilization</li>
                      <li>• Saliva pooling causing scanner confusion</li>
                    </ul>
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-3 text-primary">Solution</h3>
                  <div className="space-y-3">
                    <div className="bg-primary/5 p-4 rounded">
                      <p className="font-semibold mb-2">Technique Adjustments:</p>
                      <ul className="space-y-1 text-sm text-gray-700">
                        <li>✓ Move scanner in slow, steady motion</li>
                        <li>✓ Pause briefly when scanner tone changes</li>
                        <li>✓ Use bite block for patient stabilization</li>
                        <li>✓ Give patient "swallow breaks" every 30 sec</li>
                      </ul>
                    </div>
                    <div className="bg-primary/5 p-4 rounded">
                      <p className="font-semibold mb-2">Speed Guidelines by Scanner:</p>
                      <ul className="space-y-1 text-sm text-gray-700">
                        <li>• iTero: ~1 tooth per 3-4 seconds</li>
                        <li>• 3Shape: Continuous sweep, 1mm/sec</li>
                        <li>• Cerec: Faster OK, but watch for gaps</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6">Error 3: Missing Opposing Arch Data</h2>
            <div className="bg-light p-6 rounded-lg">
              <div className="bg-white p-6 rounded shadow-md mb-4">
                <h3 className="text-xl font-bold mb-3 text-accent">Problem</h3>
                <p className="text-gray-700 mb-3">
                  Opposing arch scan incomplete, especially distal regions, making occlusal contact design impossible.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-secondary/5 p-4 rounded">
                  <h4 className="font-semibold mb-3">Why It Happens:</h4>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li>• Operator assumes "it's not the prep, so less important"</li>
                    <li>• Difficult to scan (limited opening, gag reflex)</li>
                    <li>• Scanner loses tracking in posterior</li>
                    <li>• Saliva accumulation not managed</li>
                  </ul>
                </div>
                <div className="bg-primary/5 p-4 rounded">
                  <h4 className="font-semibold mb-3">Critical Areas:</h4>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li>✓ At least 1 tooth mesial to prep</li>
                    <li>✓ At least 2 teeth distal to prep</li>
                    <li>✓ Full occlusal surface of opposing tooth</li>
                    <li>✓ Lingual/palatal cusp tips for clearance</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6">Error 4: Inaccurate Bite Registration</h2>
            <div className="bg-light p-6 rounded-lg">
              <p className="text-gray-700 mb-6">
                Digital bite registration is the most common cause of occlusal interferences and high contacts.
              </p>
              <div className="space-y-4">
                <div className="bg-accent/10 p-6 rounded border-l-4 border-accent">
                  <h3 className="text-lg font-bold mb-3">Common Mistakes</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="font-semibold text-sm mb-2">❌ Patient Not in CR</p>
                      <p className="text-xs text-gray-700">Patient closes into habitual occlusion, not centric relation</p>
                    </div>
                    <div>
                      <p className="font-semibold text-sm mb-2">❌ Insufficient Contact Area</p>
                      <p className="text-xs text-gray-700">Only scanning buccal cusps, missing lingual/palatal</p>
                    </div>
                    <div>
                      <p className="font-semibold text-sm mb-2">❌ Soft Tissue in Way</p>
                      <p className="text-xs text-gray-700">Cheek or tongue interfering with closure</p>
                    </div>
                    <div>
                      <p className="font-semibold text-sm mb-2">❌ Motion During Capture</p>
                      <p className="text-xs text-gray-700">Patient opens slightly or shifts during bite scan</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-primary to-secondary text-white p-6 rounded">
                  <h3 className="text-lg font-bold mb-3">Correct Bite Registration Protocol</h3>
                  <ol className="space-y-2">
                    <li className="flex items-start gap-3">
                      <span className="font-bold">1.</span>
                      <span>Have patient practice closing into CR (chin point method or bimanual manipulation)</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="font-bold">2.</span>
                      <span>Dry both arches thoroughly before bite scan</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="font-bold">3.</span>
                      <span>Retract cheeks/lips away from scan area</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="font-bold">4.</span>
                      <span>Instruct: "Close gently into the back teeth and hold still"</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="font-bold">5.</span>
                      <span>Scan from buccal around to lingual on both sides</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="font-bold">6.</span>
                      <span>Verify scanner shows green "accepted" indication</span>
                    </li>
                  </ol>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6">Error 5: Powder Application Issues</h2>
            <div className="bg-light p-6 rounded-lg">
              <p className="text-gray-700 mb-4">
                For scanners requiring powder (older CEREC, some 3Shape models):
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded shadow-md">
                  <h3 className="font-bold mb-3 text-accent">Too Little Powder</h3>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li>• Shiny spots where tooth reflects light</li>
                    <li>• Scanner can't acquire surface</li>
                    <li>• Gaps in mesh data</li>
                  </ul>
                  <div className="mt-4 p-3 bg-accent/10 rounded">
                    <p className="font-semibold text-xs mb-1">Fix:</p>
                    <p className="text-xs text-gray-700">Apply additional thin layer, hold spray 10cm away</p>
                  </div>
                </div>
                <div className="bg-white p-6 rounded shadow-md">
                  <h3 className="font-bold mb-3 text-primary">Too Much Powder</h3>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li>• Visible clumps on tooth surface</li>
                    <li>• Rounded/softened margin detail</li>
                    <li>• Inaccurate dimensions (+100 microns)</li>
                  </ul>
                  <div className="mt-4 p-3 bg-primary/10 rounded">
                    <p className="font-semibold text-xs mb-1">Fix:</p>
                    <p className="text-xs text-gray-700">Blow off excess with air syringe, reapply light coat</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <div className="bg-light p-8 rounded-lg">
              <h2 className="text-3xl font-bold mb-6">Pre-Submission Quality Checklist</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-xl font-bold mb-4 text-primary">Preparation Arch</h3>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-3">
                      <span>☐</span>
                      <span className="text-gray-700">Complete margin visible 360° around prep</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span>☐</span>
                      <span className="text-gray-700">No gray/fuzzy areas on prep or adjacent teeth</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span>☐</span>
                      <span className="text-gray-700">At least 2 teeth mesial and distal captured</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span>☐</span>
                      <span className="text-gray-700">Tissue not overhanging margin</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span>☐</span>
                      <span className="text-gray-700">No motion artifacts or distortions</span>
                    </li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-4 text-secondary">Opposing & Bite</h3>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-3">
                      <span>☐</span>
                      <span className="text-gray-700">Opposing arch includes 2+ teeth past prep</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span>☐</span>
                      <span className="text-gray-700">Occlusal surfaces fully captured (not flat/smooth)</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span>☐</span>
                      <span className="text-gray-700">Bite registration shows green "accepted"</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span>☐</span>
                      <span className="text-gray-700">Contacts visible in bite scan (not gaps)</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span>☐</span>
                      <span className="text-gray-700">Buccal and lingual cusps included in bite</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <div className="bg-gradient-to-r from-secondary to-primary text-white p-8 rounded-lg">
              <h2 className="text-3xl font-bold mb-4">Lab Quality Review</h2>
              <p className="text-lg mb-6">
                Our technicians inspect every scan within 2 hours of submission. You'll receive immediate notification if rescanning is needed before we start fabrication.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white/10 p-4 rounded text-center">
                  <div className="text-3xl mb-2">✓</div>
                  <p className="font-semibold">Margin Completeness</p>
                </div>
                <div className="bg-white/10 p-4 rounded text-center">
                  <div className="text-3xl mb-2">✓</div>
                  <p className="font-semibold">Dimensional Accuracy</p>
                </div>
                <div className="bg-white/10 p-4 rounded text-center">
                  <div className="text-3xl mb-2">✓</div>
                  <p className="font-semibold">Occlusal Clearance</p>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-light p-8 rounded-lg text-center">
            <h3 className="text-2xl font-bold mb-4">Need Scanner Training?</h3>
            <p className="text-gray-700 mb-6">
              Schedule a free 1-on-1 training session with our scanning specialist
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/scans" className="btn-secondary inline-block">
                View Scanner Setup Guides
              </Link>
              <Link href="/#contact" className="btn-primary inline-block">
                Book Training Session
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

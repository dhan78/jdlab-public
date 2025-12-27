import Header from '@/components/Header'
import Footer from '@/components/Footer'
import PageBackground from '@/components/PageBackground'
import Link from 'next/link'

export default function FullArchWorkflowArticle() {
  return (
    <div className="min-h-screen">
      <PageBackground />
      <Header />

      <article className="section-padding bg-white">
        <div className="container-wide max-w-4xl">
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-5xl">📊</span>
              <span className="inline-block px-4 py-2 bg-primary/10 text-primary text-sm font-bold rounded-full uppercase tracking-wide">
                Case Studies
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              Full-Arch Restoration: A Digital Workflow Success Story
            </h1>
            <div className="flex items-center gap-6 text-gray-600 mb-6">
              <span>📅 December 2, 2024</span>
              <span>⏱️ 12 min read</span>
            </div>
            <p className="text-xl text-gray-700 leading-relaxed">
              Follow a complete full-arch implant case from initial scan to final prosthesis delivery. This case study demonstrates how digital workflow integration reduces appointments, improves accuracy, and delivers predictable outcomes.
            </p>
          </div>

          <section className="mb-12">
            <div className="bg-primary/10 p-8 rounded-lg border-l-4 border-primary">
              <h2 className="text-2xl font-bold mb-4">Patient Presentation</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-bold mb-2">Chief Complaint</h3>
                  <p className="text-gray-700 mb-4">
                    64-year-old male with failing maxillary dentition, moderate bone loss, seeking fixed solution
                  </p>
                  <h3 className="font-bold mb-2">Clinical Findings</h3>
                  <ul className="space-y-1 text-gray-700">
                    <li>• Advanced periodontal disease</li>
                    <li>• Multiple root fractures</li>
                    <li>• Inadequate remaining bone for individual implants</li>
                    <li>• Patient refused removable prosthesis</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-bold mb-2">Treatment Plan</h3>
                  <p className="text-gray-700 mb-4">
                    Full maxillary arch extraction, immediate placement of 6 implants with provisional restoration, followed by definitive zirconia hybrid prosthesis
                  </p>
                  <h3 className="font-bold mb-2">Success Criteria</h3>
                  <ul className="space-y-1 text-gray-700">
                    <li>✓ Passive fit on all implants</li>
                    <li>✓ Proper occlusion and phonetics</li>
                    <li>✓ Natural aesthetics with gingival characterization</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6">Phase 1: Digital Planning & Surgical Execution</h2>
            <div className="space-y-6">
              <div className="bg-light p-6 rounded-lg">
                <h3 className="text-xl font-bold mb-4">Step 1: CBCT & Intraoral Scanning</h3>
                <p className="text-gray-700 mb-3">
                  Pre-operative data collection combining CBCT imaging with digital impressions of existing dentition:
                </p>
                <ul className="space-y-2 text-gray-700 ml-6">
                  <li>• CBCT scan performed with radiopaque markers for registration</li>
                  <li>• iTero scan of maxillary and mandibular arches</li>
                  <li>• Face-bow registration for mounting position</li>
                  <li>• Smile photos showing lip line and tooth display</li>
                </ul>
              </div>

              <div className="bg-light p-6 rounded-lg">
                <h3 className="text-xl font-bold mb-4">Step 2: Virtual Implant Planning</h3>
                <p className="text-gray-700 mb-3">
                  CBCT data merged with IOS files in implant planning software (Blue Sky Plan):
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="bg-white p-4 rounded">
                    <h4 className="font-semibold mb-2">Implant Positioning</h4>
                    <ul className="space-y-1 text-sm text-gray-700">
                      <li>• 6 implants (#2, #4, #6, #11, #13, #15 positions)</li>
                      <li>• Angled distals to avoid sinus (30° angulation)</li>
                      <li>• Minimum 3mm inter-implant distance</li>
                      <li>• Platform positioned 3mm apical to CEJ</li>
                    </ul>
                  </div>
                  <div className="bg-white p-4 rounded">
                    <h4 className="font-semibold mb-2">Prosthetic Design</h4>
                    <ul className="space-y-1 text-sm text-gray-700">
                      <li>• Screw-retained design for retrievability</li>
                      <li>• Titanium framework for passive fit</li>
                      <li>• Hybrid design (gingival + teeth)</li>
                      <li>• Proper emergence profile at screw access</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-light p-6 rounded-lg">
                <h3 className="text-xl font-bold mb-4">Step 3: Surgical Guide & Provisional Fabrication</h3>
                <p className="text-gray-700 mb-3">
                  Lab fabricates surgical guide and provisional prosthesis prior to surgery:
                </p>
                <div className="bg-white p-4 rounded mt-3">
                  <p className="font-semibold mb-2">Two-Week Timeline:</p>
                  <div className="space-y-2 text-sm text-gray-700">
                    <p><strong>Day 1-3:</strong> Guide design approval, 3D printing initiated</p>
                    <p><strong>Day 4-7:</strong> Surgical guide printed, sterilized, validated for fit</p>
                    <p><strong>Day 8-14:</strong> Provisional milled from PMMA, multi-unit abutments attached</p>
                    <p><strong>Day 15:</strong> Surgery day - guide and provisional delivered to surgeon</p>
                  </div>
                </div>
              </div>

              <div className="bg-secondary/10 p-6 rounded-lg border-l-4 border-secondary">
                <h3 className="text-xl font-bold mb-3">Surgery Day Workflow</h3>
                <div className="space-y-3">
                  <p className="text-gray-700">
                    <strong>8:00 AM:</strong> Extractions completed, guided surgery executed with zero deviations from plan
                  </p>
                  <p className="text-gray-700">
                    <strong>10:30 AM:</strong> Multi-unit abutments torqued to 35 Ncm, provisional seated and verified
                  </p>
                  <p className="text-gray-700">
                    <strong>11:00 AM:</strong> Occlusion adjusted, patient dismissed with immediate function
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6">Phase 2: Definitive Prosthesis Fabrication</h2>
            <div className="space-y-6">
              <div className="bg-light p-6 rounded-lg">
                <h3 className="text-xl font-bold mb-4">Step 4: Four-Month Healing & Final Impression</h3>
                <p className="text-gray-700 mb-3">
                  After osseointegration confirmation, scan bodies placed for definitive impression:
                </p>
                <ul className="space-y-2 text-gray-700 ml-6">
                  <li>• Provisional removed, multi-unit abutments remain in place</li>
                  <li>• Scan bodies hand-tightened (10 Ncm)</li>
                  <li>• iTero scan with scan body library registration</li>
                  <li>• Opposing arch and bite registration captured</li>
                  <li>• Provisional re-seated same day (no time without teeth)</li>
                </ul>
              </div>

              <div className="bg-light p-6 rounded-lg">
                <h3 className="text-xl font-bold mb-4">Step 5: Digital Design & Try-In</h3>
                <p className="text-gray-700 mb-3">
                  Lab designs definitive prosthesis using scan data and provisional as reference:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div className="bg-white p-4 rounded">
                    <h4 className="font-bold text-primary mb-2">Week 1</h4>
                    <p className="text-sm text-gray-700">Framework design, metal try-in milled from titanium</p>
                  </div>
                  <div className="bg-white p-4 rounded">
                    <h4 className="font-bold text-secondary mb-2">Week 2</h4>
                    <p className="text-sm text-gray-700">Passive fit verified, teeth setup wax-up for approval</p>
                  </div>
                  <div className="bg-white p-4 rounded">
                    <h4 className="font-bold text-accent mb-2">Week 3</h4>
                    <p className="text-sm text-gray-700">Final zirconia milling, layering, glazing, delivery</p>
                  </div>
                </div>
              </div>

              <div className="bg-accent/10 p-6 rounded-lg border-l-4 border-accent">
                <h3 className="text-xl font-bold mb-3">Metal Try-In Appointment</h3>
                <p className="text-gray-700 mb-3">
                  Critical verification step before completing prosthesis:
                </p>
                <div className="space-y-2 text-gray-700 ml-6">
                  <p>✓ Framework seated with no rocking or binding</p>
                  <p>✓ Single screw test performed (tighten one screw, all others remain passive)</p>
                  <p>✓ Vertical dimension and centric relation confirmed</p>
                  <p>✓ Tooth position and smile line approved by patient</p>
                </div>
              </div>

              <div className="bg-light p-6 rounded-lg">
                <h3 className="text-xl font-bold mb-4">Step 6: Final Delivery & Occlusal Refinement</h3>
                <div className="space-y-4">
                  <p className="text-gray-700">
                    Definitive prosthesis features monolithic zirconia with hand-layered gingival characterization:
                  </p>
                  <div className="bg-white p-4 rounded">
                    <h4 className="font-semibold mb-2">Material Selection Rationale</h4>
                    <p className="text-sm text-gray-700 mb-2">
                      <strong>Zirconia Hybrid Design:</strong> Titanium framework with overpressed pink and white zirconia
                    </p>
                    <ul className="text-sm text-gray-700 space-y-1 ml-4">
                      <li>• Superior strength vs acrylic (no fractures)</li>
                      <li>• Stain-resistant surface (no coffee/wine discoloration)</li>
                      <li>• Natural translucency in incisal third</li>
                      <li>• Gingival characterization mimics tissue variation</li>
                    </ul>
                  </div>
                  <div className="bg-gradient-to-r from-primary to-secondary text-white p-4 rounded">
                    <p className="font-bold mb-2">Delivery Protocol</p>
                    <div className="space-y-2 text-sm">
                      <p>1. Torque all screws to 15 Ncm, wait 10 minutes, re-torque</p>
                      <p>2. Seal screw access holes with PTFE tape and composite</p>
                      <p>3. Refine occlusion in centric and excursions (no heavy contacts)</p>
                      <p>4. Polish any adjusted areas to high gloss</p>
                      <p>5. Home care instructions (Waterpik essential)</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <div className="bg-light p-8 rounded-lg">
              <h2 className="text-3xl font-bold mb-6">Outcome & Patient Satisfaction</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-xl font-bold mb-4">Clinical Success Metrics</h3>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <span className="text-2xl">✓</span>
                      <div>
                        <p className="font-semibold">Passive Fit Achieved</p>
                        <p className="text-sm text-gray-700">Single screw test passed on all 6 implants</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-2xl">✓</span>
                      <div>
                        <p className="font-semibold">Proper Occlusion</p>
                        <p className="text-sm text-gray-700">Bilateral simultaneous contacts, canine guidance</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-2xl">✓</span>
                      <div>
                        <p className="font-semibold">Natural Aesthetics</p>
                        <p className="text-sm text-gray-700">Proper tooth proportion, gingival zenith positions</p>
                      </div>
                    </li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-4">Patient-Reported Outcomes</h3>
                  <div className="bg-white p-4 rounded shadow-sm">
                    <p className="text-gray-700 italic mb-3">
                      "I can't believe how natural these feel. I forget they're not my real teeth. The ability to eat anything without worry has changed my life."
                    </p>
                    <p className="text-sm text-gray-600">— Patient testimonial, 6-month follow-up</p>
                  </div>
                  <div className="mt-4 space-y-2 text-sm text-gray-700">
                    <p><strong>Chewing efficiency:</strong> Restored to 85% of natural dentition</p>
                    <p><strong>Phonetics:</strong> Normal speech within 2 weeks</p>
                    <p><strong>Maintenance:</strong> Home care compliance excellent</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <div className="bg-gradient-to-r from-primary to-secondary text-white p-8 rounded-lg">
              <h2 className="text-3xl font-bold mb-4">Key Takeaways for Full-Arch Success</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div>
                  <h3 className="text-xl font-bold mb-3">Digital Workflow Advantages</h3>
                  <ul className="space-y-2">
                    <li>• Predictable implant placement (zero surgical deviations)</li>
                    <li>• Immediate provisional (patient never without teeth)</li>
                    <li>• Reduced chair time (2 appointments vs 6+ traditional)</li>
                    <li>• Superior fit accuracy (digital impression vs analog)</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-3">Critical Success Factors</h3>
                  <ul className="space-y-2">
                    <li>• Comprehensive treatment planning upfront</li>
                    <li>• Lab-surgeon communication throughout</li>
                    <li>• Material selection based on patient factors</li>
                    <li>• Verification steps (try-ins, passive fit tests)</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-light p-8 rounded-lg text-center">
            <h3 className="text-2xl font-bold mb-4">Ready to Offer Full-Arch Restorations?</h3>
            <p className="text-gray-700 mb-6">
              Partner with a lab experienced in complex implant cases and digital workflow integration
            </p>
            <Link href="/#contact" className="btn-primary inline-block">
              Schedule Case Consultation
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

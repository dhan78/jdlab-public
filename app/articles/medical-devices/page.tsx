import Header from '@/components/Header'
import Footer from '@/components/Footer'
import PageBackground from '@/components/PageBackground'
import Link from 'next/link'

export default function MedicalDevicesArticle() {
  return (
    <div className="min-h-screen">
      <PageBackground />
      <Header />

      <article className="section-padding bg-white">
        <div className="container-wide max-w-4xl">
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-5xl">🏥</span>
              <span className="inline-block px-4 py-2 bg-secondary/10 text-secondary text-sm font-bold rounded-full uppercase tracking-wide">
                Medical Devices
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              Custom Medical Device Manufacturing: Quality Standards & Compliance
            </h1>
            <div className="flex items-center gap-6 text-gray-600 mb-6">
              <span>📅 December 4, 2024</span>
              <span>⏱️ 10 min read</span>
            </div>
            <p className="text-xl text-gray-700 leading-relaxed">
              Moving beyond dental applications into custom medical device fabrication requires rigorous quality systems and regulatory compliance. Understand the standards that ensure patient safety and device efficacy.
            </p>
          </div>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6">Regulatory Framework</h2>
            <div className="space-y-6">
              <div className="bg-light p-6 rounded-lg">
                <h3 className="text-xl font-bold mb-4">FDA Classification Overview</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b-2 border-gray-300">
                        <th className="py-3 px-4 font-bold">Class</th>
                        <th className="py-3 px-4 font-bold">Risk Level</th>
                        <th className="py-3 px-4 font-bold">Examples</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-gray-200">
                        <td className="py-3 px-4">Class I</td>
                        <td className="py-3 px-4">Low Risk</td>
                        <td className="py-3 px-4">Dental impression trays, tongue depressors</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="py-3 px-4">Class II</td>
                        <td className="py-3 px-4">Moderate Risk</td>
                        <td className="py-3 px-4">Surgical guides, custom crowns</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4">Class III</td>
                        <td className="py-3 px-4">High Risk</td>
                        <td className="py-3 px-4">Implantable devices, life-support equipment</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-primary/5 p-6 rounded-lg border border-primary/20">
                  <h3 className="text-lg font-bold mb-3">ISO 13485 Requirements</h3>
                  <ul className="space-y-2 text-gray-700">
                    <li>• Quality management system documentation</li>
                    <li>• Risk management processes</li>
                    <li>• Design control procedures</li>
                    <li>• Supplier qualification protocols</li>
                    <li>• Post-market surveillance</li>
                  </ul>
                </div>
                <div className="bg-secondary/5 p-6 rounded-lg border border-secondary/20">
                  <h3 className="text-lg font-bold mb-3">GMP Compliance</h3>
                  <ul className="space-y-2 text-gray-700">
                    <li>• Controlled manufacturing environment</li>
                    <li>• Process validation protocols</li>
                    <li>• Equipment calibration schedules</li>
                    <li>• Batch traceability systems</li>
                    <li>• CAPA (Corrective/Preventive Actions)</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6">Material Selection & Biocompatibility</h2>
            <div className="space-y-6">
              <p className="text-gray-700 text-lg">
                All materials used in custom medical device fabrication must meet stringent biocompatibility standards outlined in ISO 10993 series.
              </p>

              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-xl font-bold mb-4">Testing Requirements by Contact Type</h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-bold text-primary mb-2">Surface Contact Devices (≤24 hours)</h4>
                    <p className="text-gray-700 text-sm">Cytotoxicity, sensitization, irritation tests required</p>
                  </div>
                  <div>
                    <h4 className="font-bold text-secondary mb-2">External Communicating (≤30 days)</h4>
                    <p className="text-gray-700 text-sm">Additional hemocompatibility and subacute toxicity testing</p>
                  </div>
                  <div>
                    <h4 className="font-bold text-accent mb-2">Implant Devices (&gt;30 days)</h4>
                    <p className="text-gray-700 text-sm">Comprehensive testing including genotoxicity, chronic toxicity, carcinogenicity</p>
                  </div>
                </div>
              </div>

              <div className="bg-light p-6 rounded-lg">
                <h3 className="text-xl font-bold mb-4">Approved Materials for Medical Applications</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">Metals</h4>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>• Titanium (Grade 23)</li>
                      <li>• Cobalt-Chromium</li>
                      <li>• Stainless Steel 316L</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Polymers</h4>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>• PEEK</li>
                      <li>• Medical-grade PMMA</li>
                      <li>• Biocompatible resins</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Ceramics</h4>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>• Zirconia (3Y-TZP)</li>
                      <li>• Alumina</li>
                      <li>• Bioactive glass</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6">Quality Control Protocols</h2>
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-primary to-secondary text-white p-8 rounded-lg">
                <h3 className="text-2xl font-bold mb-4">Six-Stage Inspection Process</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="font-bold">1.</span>
                    <span>Incoming Material Verification - Certificate of conformance review</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="font-bold">2.</span>
                    <span>In-Process Inspection - Dimensional checks at critical stages</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="font-bold">3.</span>
                    <span>Final Dimensional Validation - CMM or optical scanning</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="font-bold">4.</span>
                    <span>Surface Finish Evaluation - Roughness and cleanliness verification</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="font-bold">5.</span>
                    <span>Biocompatibility Confirmation - Batch testing documentation</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="font-bold">6.</span>
                    <span>Packaging Integrity - Sterile barrier validation before shipment</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-md">
                  <h3 className="text-lg font-bold mb-3">Documentation Requirements</h3>
                  <ul className="space-y-2 text-gray-700 text-sm">
                    <li>✓ Device Master Record (DMR)</li>
                    <li>✓ Device History Record (DHR)</li>
                    <li>✓ Material certificates</li>
                    <li>✓ Inspection reports</li>
                    <li>✓ Sterilization validation</li>
                    <li>✓ Traceability labels (UDI)</li>
                  </ul>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md">
                  <h3 className="text-lg font-bold mb-3">Audit Readiness</h3>
                  <ul className="space-y-2 text-gray-700 text-sm">
                    <li>✓ Annual internal audits</li>
                    <li>✓ Management review meetings</li>
                    <li>✓ Employee training records</li>
                    <li>✓ Complaint handling logs</li>
                    <li>✓ Non-conformance tracking</li>
                    <li>✓ Continuous improvement metrics</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <div className="bg-light p-8 rounded-lg">
              <h2 className="text-3xl font-bold mb-4">Custom Device Development Process</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="bg-primary text-white w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold">
                    1
                  </div>
                  <div>
                    <h4 className="font-bold mb-1">Design Input Phase</h4>
                    <p className="text-gray-700 text-sm">Clinical requirements, user needs, regulatory standards</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="bg-primary text-white w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold">
                    2
                  </div>
                  <div>
                    <h4 className="font-bold mb-1">Risk Analysis</h4>
                    <p className="text-gray-700 text-sm">FMEA, hazard analysis, risk mitigation strategies</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="bg-primary text-white w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold">
                    3
                  </div>
                  <div>
                    <h4 className="font-bold mb-1">Design Verification & Validation</h4>
                    <p className="text-gray-700 text-sm">Testing against specifications, clinical evaluation</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="bg-primary text-white w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold">
                    4
                  </div>
                  <div>
                    <h4 className="font-bold mb-1">Process Validation</h4>
                    <p className="text-gray-700 text-sm">IQ/OQ/PQ protocols, production consistency demonstration</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="bg-primary text-white w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold">
                    5
                  </div>
                  <div>
                    <h4 className="font-bold mb-1">Regulatory Submission</h4>
                    <p className="text-gray-700 text-sm">510(k), PMA, or CE marking documentation</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="bg-primary text-white w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold">
                    6
                  </div>
                  <div>
                    <h4 className="font-bold mb-1">Post-Market Surveillance</h4>
                    <p className="text-gray-700 text-sm">Adverse event reporting, field corrective actions</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-gradient-to-r from-secondary to-primary text-white p-8 rounded-lg text-center">
            <h3 className="text-2xl font-bold mb-4">ISO 13485 Certified Facility</h3>
            <p className="mb-6 text-lg">
              Partner with a lab that understands medical device compliance from design through delivery
            </p>
            <Link href="/#contact" className="bg-white text-primary px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors inline-block">
              Discuss Your Project
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

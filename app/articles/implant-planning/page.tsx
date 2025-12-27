import Header from '@/components/Header'
import Footer from '@/components/Footer'
import PageBackground from '@/components/PageBackground'
import Link from 'next/link'

export default function ImplantPlanningArticle() {
  return (
    <div className="min-h-screen">
      <PageBackground />
      <Header />

      <article className="section-padding bg-white">
        <div className="container-wide max-w-4xl">
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-5xl">🦷</span>
              <span className="inline-block px-4 py-2 bg-primary/10 text-primary text-sm font-bold rounded-full uppercase tracking-wide">
                Implants
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              Guided Surgery Planning: From Scan to Surgical Guide
            </h1>
            <div className="flex items-center gap-6 text-gray-600 mb-6">
              <span>📅 December 10, 2024</span>
              <span>⏱️ 8 min read</span>
            </div>
            <p className="text-xl text-gray-700 leading-relaxed">
              Digital implant planning transforms complex cases into predictable procedures. Learn the complete workflow from initial scan to fabrication of precision surgical guides.
            </p>
          </div>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-4">The Digital Implant Planning Revolution</h2>
            <p className="text-gray-700 mb-4 leading-relaxed">
              Freehand implant placement relies heavily on clinical experience and spatial visualization. While skilled clinicians achieve good results, the margin for error remains significant—especially in complex anatomical situations.
            </p>
            <p className="text-gray-700 mb-4 leading-relaxed">
              Guided surgery eliminates guesswork. By combining intraoral scans with CBCT imaging, clinicians can plan ideal implant positions digitally, then transfer that plan precisely to the surgical field using custom guides. Studies show guided surgery reduces placement errors by 70-85% compared to freehand techniques.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6">Complete Workflow: Step by Step</h2>
            
            <div className="space-y-6">
              <div className="bg-light p-6 rounded-lg border-l-4 border-primary">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl font-bold text-primary">1</span>
                  <h3 className="text-xl font-bold">Initial Data Capture</h3>
                </div>
                <p className="text-gray-700 mb-3">Gather comprehensive diagnostic information:</p>
                <ul className="space-y-2 text-gray-700 ml-6">
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span><strong>CBCT Scan:</strong> Captures bone volume, nerve location, sinus position</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span><strong>Intraoral Scan:</strong> Documents existing dentition and soft tissue</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span><strong>Opposing Arch:</strong> Required for restorative planning</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span><strong>Bite Registration:</strong> Establishes occlusal relationship</span>
                  </li>
                </ul>
              </div>

              <div className="bg-light p-6 rounded-lg border-l-4 border-secondary">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl font-bold text-secondary">2</span>
                  <h3 className="text-xl font-bold">Data Alignment & Integration</h3>
                </div>
                <p className="text-gray-700 mb-3">Merge CBCT and IOS data into unified model:</p>
                <ul className="space-y-2 text-gray-700 ml-6">
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span>Software superimposes intraoral scan onto CBCT using surface matching</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span>Verify alignment accuracy (±0.2mm tolerance)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span>Creates composite view showing anatomy AND restorative space</span>
                  </li>
                </ul>
              </div>

              <div className="bg-light p-6 rounded-lg border-l-4 border-accent">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl font-bold text-accent">3</span>
                  <h3 className="text-xl font-bold">Virtual Implant Placement</h3>
                </div>
                <p className="text-gray-700 mb-3">Position implants for optimal outcomes:</p>
                <ul className="space-y-2 text-gray-700 ml-6">
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span><strong>Restoratively Driven:</strong> Start by designing ideal crown position</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span><strong>Anatomical Constraints:</strong> Maintain 2mm from adjacent roots, nerves</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span><strong>Bone Quality:</strong> Verify adequate bone thickness (1.5mm buccal minimum)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span><strong>Angulation:</strong> Optimize emergence profile and screw access</span>
                  </li>
                </ul>
              </div>

              <div className="bg-light p-6 rounded-lg border-l-4 border-primary">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl font-bold text-primary">4</span>
                  <h3 className="text-xl font-bold">Surgical Guide Design</h3>
                </div>
                <p className="text-gray-700 mb-3">Create guide that transfers plan to surgery:</p>
                <ul className="space-y-2 text-gray-700 ml-6">
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span><strong>Tissue Support:</strong> Rests on gingiva (most common for partial cases)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span><strong>Tooth Support:</strong> Anchors to adjacent teeth for maximum stability</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span><strong>Bone Support:</strong> For edentulous cases or when tissue unreliable</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span>Metal sleeves embedded in guide ensure drilling precision</span>
                  </li>
                </ul>
              </div>

              <div className="bg-light p-6 rounded-lg border-l-4 border-secondary">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl font-bold text-secondary">5</span>
                  <h3 className="text-xl font-bold">Fabrication & Verification</h3>
                </div>
                <p className="text-gray-700 mb-3">3D print guide and verify accuracy:</p>
                <ul className="space-y-2 text-gray-700 ml-6">
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span>Print in biocompatible, autoclavable resin</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span>Insert metal sleeves and secure with fixation pins</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span>Test fit guide on model or patient pre-operatively</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span>Verify drill sequence matches implant system protocol</span>
                  </li>
                </ul>
              </div>

              <div className="bg-light p-6 rounded-lg border-l-4 border-accent">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl font-bold text-accent">6</span>
                  <h3 className="text-xl font-bold">Guided Surgery Execution</h3>
                </div>
                <p className="text-gray-700 mb-3">Surgical procedure with guide:</p>
                <ul className="space-y-2 text-gray-700 ml-6">
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span>Seat guide firmly and secure with fixation screws if needed</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span>Use guided drill sequence (pilot → final diameter)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span>Implant placement through guide sleeve ensures exact position/angle</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span>Often flapless approach reduces surgical time and patient discomfort</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6">Key Benefits of Guided Surgery</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-xl font-bold mb-3 text-primary">🎯 Predictability</h3>
                <p className="text-gray-700">
                  Eliminates surgical guesswork. Plan is executed exactly as designed, reducing complications.
                </p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-xl font-bold mb-3 text-primary">⚡ Efficiency</h3>
                <p className="text-gray-700">
                  Reduces surgical time by 30-40%. Flapless procedures heal faster with less post-op discomfort.
                </p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-xl font-bold mb-3 text-primary">🛡️ Safety</h3>
                <p className="text-gray-700">
                  Protects anatomical structures (nerves, sinuses, adjacent roots) with precision planning.
                </p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-xl font-bold mb-3 text-primary">🦷 Prosthetic Excellence</h3>
                <p className="text-gray-700">
                  Restoratively-driven planning ensures ideal crown emergence and screw access.
                </p>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <div className="bg-gradient-to-r from-primary to-secondary text-white p-8 rounded-lg">
              <h2 className="text-3xl font-bold mb-4">Best Practices for Success</h2>
              <ul className="space-y-3 text-lg">
                <li className="flex items-start gap-3">
                  <span>✓</span>
                  <span>Always plan from final restoration backward to implant position</span>
                </li>
                <li className="flex items-start gap-3">
                  <span>✓</span>
                  <span>Verify guide fit before surgery—adjust if necessary</span>
                </li>
                <li className="flex items-start gap-3">
                  <span>✓</span>
                  <span>Use copious irrigation during guided drilling</span>
                </li>
                <li className="flex items-start gap-3">
                  <span>✓</span>
                  <span>Have backup plan if guide doesn't seat properly</span>
                </li>
                <li className="flex items-start gap-3">
                  <span>✓</span>
                  <span>Consider provisional restoration for immediate load cases</span>
                </li>
              </ul>
            </div>
          </section>

          <section className="bg-light p-8 rounded-lg text-center">
            <h3 className="text-2xl font-bold mb-4">Expert Implant Planning Services</h3>
            <p className="text-gray-700 mb-6">
              Our team creates precision surgical guides for simple to complex implant cases
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/#contact" className="btn-primary">
                Request Consultation
              </Link>
              <Link href="/scans" className="btn-secondary">
                Send Scan Files
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

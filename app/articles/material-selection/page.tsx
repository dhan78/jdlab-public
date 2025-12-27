import Header from '@/components/Header'
import Footer from '@/components/Footer'
import PageBackground from '@/components/PageBackground'
import Link from 'next/link'

export default function MaterialSelectionArticle() {
  return (
    <div className="min-h-screen">
      <PageBackground />
      <Header />

      <article className="section-padding bg-white">
        <div className="container-wide max-w-4xl">
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-5xl">🔬</span>
              <span className="inline-block px-4 py-2 bg-accent/10 text-accent text-sm font-bold rounded-full uppercase tracking-wide">
                Materials
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              Material Selection Guide: Zirconia vs Lithium Disilicate
            </h1>
            <div className="flex items-center gap-6 text-gray-600 mb-6">
              <span>📅 December 3, 2024</span>
              <span>⏱️ 6 min read</span>
            </div>
            <p className="text-xl text-gray-700 leading-relaxed">
              Choosing between zirconia and lithium disilicate for ceramic restorations impacts aesthetics, strength, and longevity. This guide compares material properties to help you select the optimal option for each clinical scenario.
            </p>
          </div>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6">Material Properties Comparison</h2>
            <div className="bg-light p-6 rounded-lg overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="py-3 px-4 font-bold">Property</th>
                    <th className="py-3 px-4 font-bold">Zirconia</th>
                    <th className="py-3 px-4 font-bold">Lithium Disilicate</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-200">
                    <td className="py-3 px-4 font-semibold">Flexural Strength</td>
                    <td className="py-3 px-4">900-1200 MPa</td>
                    <td className="py-3 px-4">350-450 MPa</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="py-3 px-4 font-semibold">Translucency</td>
                    <td className="py-3 px-4">Opaque to High (depending on type)</td>
                    <td className="py-3 px-4">High translucency</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="py-3 px-4 font-semibold">Minimum Thickness</td>
                    <td className="py-3 px-4">0.5mm</td>
                    <td className="py-3 px-4">1.0-1.5mm</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="py-3 px-4 font-semibold">Cementation</td>
                    <td className="py-3 px-4">Conventional or adhesive</td>
                    <td className="py-3 px-4">Adhesive required</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="py-3 px-4 font-semibold">Machinability</td>
                    <td className="py-3 px-4">Pre-sintered (soft)</td>
                    <td className="py-3 px-4">Glass-ceramic (hard)</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold">Typical Indications</td>
                    <td className="py-3 px-4">Posterior crowns, bridges, implants</td>
                    <td className="py-3 px-4">Anterior crowns, veneers, inlays</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6">When to Choose Zirconia</h2>
            <div className="space-y-6">
              <div className="bg-primary/5 p-6 rounded-lg border-l-4 border-primary">
                <h3 className="text-xl font-bold mb-3">Posterior Crowns & Bridges</h3>
                <p className="text-gray-700 mb-3">
                  Zirconia's superior strength makes it ideal for high-stress situations:
                </p>
                <ul className="space-y-2 text-gray-700 ml-6">
                  <li>• Multi-unit bridges (up to 14 units possible)</li>
                  <li>• Patients with bruxism or heavy occlusal forces</li>
                  <li>• Minimal preparation space (thin walls acceptable)</li>
                  <li>• Long-span bridges where deflection is a concern</li>
                </ul>
              </div>

              <div className="bg-primary/5 p-6 rounded-lg border-l-4 border-primary">
                <h3 className="text-xl font-bold mb-3">Implant Restorations</h3>
                <p className="text-gray-700 mb-3">
                  Zirconia abutments and crowns offer biocompatibility advantages:
                </p>
                <ul className="space-y-2 text-gray-700 ml-6">
                  <li>• No metal show-through in thin tissue biotypes</li>
                  <li>• Reduced plaque accumulation vs titanium</li>
                  <li>• Monolithic design eliminates chipping risk</li>
                  <li>• Custom emergence profile for optimal tissue health</li>
                </ul>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-md">
                  <h4 className="font-bold text-primary mb-3">Zirconia Types Available</h4>
                  <div className="space-y-2 text-sm">
                    <p><strong>3Y-TZP:</strong> High strength, lower translucency (posterior)</p>
                    <p><strong>4Y-TZP:</strong> Balanced strength/aesthetics (premolars)</p>
                    <p><strong>5Y-TZP:</strong> Maximum translucency (anterior)</p>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md">
                  <h4 className="font-bold text-primary mb-3">Preparation Guidelines</h4>
                  <div className="space-y-2 text-sm">
                    <p><strong>Occlusal reduction:</strong> 1.5mm minimum</p>
                    <p><strong>Axial reduction:</strong> 1.0mm circumferential</p>
                    <p><strong>Margin design:</strong> Chamfer or rounded shoulder</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6">When to Choose Lithium Disilicate</h2>
            <div className="space-y-6">
              <div className="bg-secondary/5 p-6 rounded-lg border-l-4 border-secondary">
                <h3 className="text-xl font-bold mb-3">Anterior Restorations</h3>
                <p className="text-gray-700 mb-3">
                  Lithium disilicate excels where aesthetics are paramount:
                </p>
                <ul className="space-y-2 text-gray-700 ml-6">
                  <li>• Anterior crowns with high translucency requirements</li>
                  <li>• Minimal prep veneers (0.5-0.8mm thickness)</li>
                  <li>• Cases requiring precise shade matching</li>
                  <li>• Young patients with vital teeth (avoid opacity)</li>
                </ul>
              </div>

              <div className="bg-secondary/5 p-6 rounded-lg border-l-4 border-secondary">
                <h3 className="text-xl font-bold mb-3">Inlays & Onlays</h3>
                <p className="text-gray-700 mb-3">
                  Glass-ceramic properties enable conservative restorations:
                </p>
                <ul className="space-y-2 text-gray-700 ml-6">
                  <li>• Tooth-like wear characteristics (won't damage opposing)</li>
                  <li>• Excellent bond strength with adhesive cementation</li>
                  <li>• Ability to etch for micro-mechanical retention</li>
                  <li>• Seamless integration with remaining tooth structure</li>
                </ul>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-md">
                  <h4 className="font-bold text-secondary mb-3">Cementation Protocol</h4>
                  <div className="space-y-2 text-sm">
                    <p><strong>Step 1:</strong> HF acid etch (20 seconds)</p>
                    <p><strong>Step 2:</strong> Silane application</p>
                    <p><strong>Step 3:</strong> Adhesive resin cement</p>
                    <p><strong>Critical:</strong> Light cure fully before loading</p>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md">
                  <h4 className="font-bold text-secondary mb-3">Contraindications</h4>
                  <div className="space-y-2 text-sm">
                    <p>❌ Three-unit or longer bridges</p>
                    <p>❌ Severe bruxism cases</p>
                    <p>❌ Preparation depth less than 1.0mm</p>
                    <p>❌ Dry field isolation not achievable</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <div className="bg-gradient-to-r from-primary to-secondary text-white p-8 rounded-lg">
              <h2 className="text-3xl font-bold mb-6">Decision-Making Flowchart</h2>
              <div className="space-y-4 text-lg">
                <div className="bg-white/10 p-4 rounded">
                  <p className="font-bold mb-2">Start: What is the location?</p>
                  <p className="text-sm">Anterior → Consider aesthetics priority</p>
                  <p className="text-sm">Posterior → Consider strength priority</p>
                </div>
                <div className="bg-white/10 p-4 rounded">
                  <p className="font-bold mb-2">Is it a multi-unit restoration?</p>
                  <p className="text-sm">Yes → Zirconia (strength required)</p>
                  <p className="text-sm">No → Proceed to next question</p>
                </div>
                <div className="bg-white/10 p-4 rounded">
                  <p className="font-bold mb-2">Heavy occlusal forces or bruxism?</p>
                  <p className="text-sm">Yes → Zirconia (durability needed)</p>
                  <p className="text-sm">No → Proceed to next question</p>
                </div>
                <div className="bg-white/10 p-4 rounded">
                  <p className="font-bold mb-2">Maximum aesthetics required?</p>
                  <p className="text-sm">Yes → Lithium disilicate (translucency)</p>
                  <p className="text-sm">No → Either material appropriate</p>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-light p-8 rounded-lg text-center">
            <h3 className="text-2xl font-bold mb-4">Expert Material Consultation</h3>
            <p className="text-gray-700 mb-6">
              Not sure which material is right for your case? Our technicians provide free pre-case consultation
            </p>
            <Link href="/#contact" className="btn-primary inline-block">
              Get Material Recommendation
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

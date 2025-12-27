import Header from '@/components/Header'
import Footer from '@/components/Footer'
import PageBackground from '@/components/PageBackground'
import Link from 'next/link'

export default function CrownBridgeArticle() {
  return (
    <div className="min-h-screen">
      <PageBackground />
      <Header />

      <article className="section-padding bg-white">
        <div className="container-wide max-w-4xl">
          {/* Article Header */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-5xl">🎯</span>
              <span className="inline-block px-4 py-2 bg-primary/10 text-primary text-sm font-bold rounded-full uppercase tracking-wide">
                Best Practices
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              Achieving Perfect Margins: Digital Design Tips for Crown & Bridge
            </h1>
            <div className="flex items-center gap-6 text-gray-600 mb-6">
              <span>📅 December 15, 2024</span>
              <span>⏱️ 7 min read</span>
            </div>
            <p className="text-xl text-gray-700 leading-relaxed">
              Marginal accuracy is the foundation of successful crown and bridge restorations. Learn how digital design tools and best practices can help you achieve consistently precise margins for optimal fit and longevity.
            </p>
          </div>

          {/* Content sections */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-4">Why Margins Matter</h2>
            <p className="text-gray-700 mb-4 leading-relaxed">
              The margin is where your restoration meets the prepared tooth. Poor marginal fit leads to cement washout, bacterial infiltration, secondary decay, and ultimately restoration failure. Studies show that marginal gaps exceeding 120 microns significantly increase the risk of complications.
            </p>
            <p className="text-gray-700 mb-4 leading-relaxed">
              Digital design allows for unprecedented precision, with tolerances as tight as 20-50 microns when executed properly. However, achieving this requires understanding both the technology and fundamental design principles.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6">Essential Digital Design Principles</h2>
            
            <div className="space-y-6">
              <div className="bg-light p-6 rounded-lg">
                <h3 className="text-xl font-bold mb-3 text-primary">1. Scan Quality is Everything</h3>
                <p className="text-gray-700 mb-3">Your design is only as good as your scan. Follow these guidelines:</p>
                <ul className="space-y-2 text-gray-700 ml-6">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Ensure adequate moisture control during scanning</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Capture the entire margin line with no voids or gaps</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Scan adjacent teeth and opposing arch completely</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Verify margin clarity before sending to lab</span>
                  </li>
                </ul>
              </div>

              <div className="bg-light p-6 rounded-lg">
                <h3 className="text-xl font-bold mb-3 text-primary">2. Margin Line Definition</h3>
                <p className="text-gray-700 mb-3">Accurate margin tracing is critical:</p>
                <ul className="space-y-2 text-gray-700 ml-6">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Use continuous, smooth curves—avoid sharp angles</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Place margin line at finish line, not above or below</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Maintain consistent depth around entire circumference</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Review margin in multiple viewing angles</span>
                  </li>
                </ul>
              </div>

              <div className="bg-light p-6 rounded-lg">
                <h3 className="text-xl font-bold mb-3 text-primary">3. Cement Space Optimization</h3>
                <p className="text-gray-700 mb-3">Proper cement space ensures passive fit:</p>
                <ul className="space-y-2 text-gray-700 ml-6">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Standard cement space: 40-80 microns (varies by material)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Reduce to 20-30 microns at margin for tight seal</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Gradually increase space 1-2mm above margin</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Adjust based on cement type and material rigidity</span>
                  </li>
                </ul>
              </div>

              <div className="bg-light p-6 rounded-lg">
                <h3 className="text-xl font-bold mb-3 text-primary">4. Emergence Profile Control</h3>
                <p className="text-gray-700 mb-3">Proper contours prevent inflammation and facilitate hygiene:</p>
                <ul className="space-y-2 text-gray-700 ml-6">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Crown should emerge smoothly from gingiva at 15-30° angle</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Avoid over-contouring which compresses tissue</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Under-contouring leaves gaps for plaque accumulation</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Reference adjacent natural teeth for ideal profile</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6">Common Margin Errors to Avoid</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-accent">
                <h3 className="text-lg font-bold mb-2">❌ Incomplete Margin Capture</h3>
                <p className="text-gray-700 text-sm">
                  Missing data at finish line due to moisture, blood, or inadequate scanning technique. Always verify complete margin before finalizing.
                </p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-accent">
                <h3 className="text-lg font-bold mb-2">❌ Excessive Cement Space</h3>
                <p className="text-gray-700 text-sm">
                  Too much space causes rocking, poor retention, and cement washout. Stick to manufacturer-recommended values.
                </p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-accent">
                <h3 className="text-lg font-bold mb-2">❌ Inconsistent Margin Thickness</h3>
                <p className="text-gray-700 text-sm">
                  Thin margins fracture during try-in or function. Maintain minimum 0.5mm thickness around entire circumference.
                </p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-accent">
                <h3 className="text-lg font-bold mb-2">❌ Over-Extended Margins</h3>
                <p className="text-gray-700 text-sm">
                  Margins extending beyond prep line impinge on tissue, causing inflammation and discomfort.
                </p>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6">Material-Specific Considerations</h2>
            <div className="space-y-4">
              <div className="bg-light p-5 rounded-lg">
                <h4 className="font-bold text-lg mb-2">Zirconia Restorations</h4>
                <p className="text-gray-700">
                  Requires minimum 0.5-0.7mm margin thickness for strength. Slightly larger cement space (50-80 microns) accommodates material rigidity.
                </p>
              </div>
              <div className="bg-light p-5 rounded-lg">
                <h4 className="font-bold text-lg mb-2">Lithium Disilicate</h4>
                <p className="text-gray-700">
                  More forgiving due to adhesive bonding. Can achieve finer margins (0.3-0.5mm). Standard cement space of 40-60 microns works well.
                </p>
              </div>
              <div className="bg-light p-5 rounded-lg">
                <h4 className="font-bold text-lg mb-2">PFM (Porcelain-Fused-to-Metal)</h4>
                <p className="text-gray-700">
                  Metal collar provides strength at margin. Ensure adequate metal thickness (0.3mm minimum) before porcelain application.
                </p>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <div className="bg-gradient-to-r from-primary to-secondary text-white p-8 rounded-lg">
              <h2 className="text-3xl font-bold mb-4">Key Takeaways</h2>
              <ul className="space-y-3 text-lg">
                <li className="flex items-start gap-3">
                  <span className="text-2xl">✓</span>
                  <span>Perfect margins start with perfect scans—invest time in capture quality</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-2xl">✓</span>
                  <span>Use design software tools to verify margin continuity and thickness</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-2xl">✓</span>
                  <span>Adjust cement space and emergence profile based on material and clinical situation</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-2xl">✓</span>
                  <span>Communicate with your lab about specific requirements and preferences</span>
                </li>
              </ul>
            </div>
          </section>

          <section className="bg-light p-8 rounded-lg text-center">
            <h3 className="text-2xl font-bold mb-4">Need Expert Crown & Bridge Design?</h3>
            <p className="text-gray-700 mb-6">
              Our digital lab team specializes in precision crown and bridge restorations with optimal marginal fit
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/#contact" className="btn-primary">
                Submit a Case
              </Link>
              <Link href="/scans" className="btn-secondary">
                Send Digital Scans
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

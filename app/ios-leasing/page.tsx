import Header from '@/components/Header'
import Footer from '@/components/Footer'
import PageBackground from '@/components/PageBackground'
import Link from 'next/link'

export default function IOSLeasingPage() {
  const benefits = [
    {
      emoji: '💰',
      title: 'No Capital Expense',
      description: 'Get started with digital dentistry without the upfront investment in expensive equipment'
    },
    {
      emoji: '📉',
      title: 'Low Monthly Payment',
      description: 'The more digital cases you send to us, the lower your monthly payment becomes'
    },
    {
      emoji: '🚀',
      title: 'Immediate Start',
      description: 'Begin digitizing your workflow right away with our scanner leasing program'
    },
    {
      emoji: '🔧',
      title: 'Full Support',
      description: 'Training, technical support, and maintenance included in your leasing agreement'
    },
    {
      emoji: '📊',
      title: 'Flexible Terms',
      description: 'Customizable leasing options that grow with your practice needs'
    },
    {
      emoji: '✨',
      title: 'Latest Technology',
      description: 'Access to state-of-the-art intraoral scanners without obsolescence risk'
    }
  ]

  const scannerOptions = [
    {
      name: 'iTero Scanner',
      image: '/images/itero-scanner.png',
      features: ['High accuracy', 'Real-time visualization', 'Seamless integration']
    },
    {
      name: '3Shape TRIOS',
      image: '/images/3-shape-trios-compressor.png',
      features: ['AI-powered scanning', 'Shade measurement', 'Patient communication']
    },
    {
      name: 'Medit i500',
      image: '/images/medit-i500.png',
      features: ['Fast scanning speed', 'Lightweight design', 'Affordable option']
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
              Digitize Your Workflow with Our Scanner Leasing Program
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Transform your dental practice with intraoral scanning technology—without the upfront investment
            </p>
            <Link href="#contact-leasing" className="btn-primary inline-block">
              Ask About Our Leasing Program
            </Link>
          </div>
        </div>
      </section>

      {/* Main Benefits */}
      <section className="section-padding bg-white">
        <div className="container-wide">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Why Choose Our Leasing Program?</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Get all the benefits of digital dentistry with flexible terms designed for growing practices
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {benefits.map((benefit, index) => (
              <div key={index} className="bg-light p-6 rounded-lg">
                <div className="text-5xl mb-4">{benefit.emoji}</div>
                <h3 className="text-xl font-bold mb-2">{benefit.title}</h3>
                <p className="text-gray-600">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Have an IOS */}
      <section className="section-padding bg-gradient-to-b from-light to-white">
        <div className="container-wide max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Why Your Dental Practice Should Have an IOS</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Transform your practice with intraoral scanning technology that benefits you, your staff, and your patients
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-primary">
              <h3 className="text-xl font-bold mb-3 text-primary">⚡ Fast and Easy Transmission</h3>
              <p className="text-gray-600">
                Send scans directly to the lab in seconds—no shipping, no waiting, no lost packages
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-secondary">
              <h3 className="text-xl font-bold mb-3 text-secondary">🧼 Clean and Hygienic</h3>
              <p className="text-gray-600">
                Avoid the messy and time-consuming preparation of traditional/physical (possibly contaminated) impressions. Easy clean up and disinfection.
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-accent">
              <h3 className="text-xl font-bold mb-3 text-accent">😊 Patient Comfort</h3>
              <p className="text-gray-600">
                No patient discomfort or gagging that traditional/physical impressions cause. Patients appreciate the modern, comfortable experience.
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-primary">
              <h3 className="text-xl font-bold mb-3 text-primary">📈 Grow Your Practice</h3>
              <p className="text-gray-600">
                Digital scanning is a great marketing tool. Studies show patients love the instantaneous 3-D picture and believe doctors using digital impression systems are more expert, accomplished, and advanced.
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-secondary">
              <h3 className="text-xl font-bold mb-3 text-secondary">🎯 Superior Accuracy</h3>
              <p className="text-gray-600">
                Intraoral scanning is lauded for its accuracy, resulting in better-fitting restorations and fewer remakes.
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-accent">
              <h3 className="text-xl font-bold mb-3 text-accent">⏱️ Efficient Chair Time</h3>
              <p className="text-gray-600">
                Optimize appointment scheduling with faster impression-taking, benefiting both you and your patients.
              </p>
            </div>
          </div>

          <div className="mt-12 bg-primary text-white p-8 rounded-lg text-center">
            <h3 className="text-2xl font-bold mb-3">Ready to Modernize Your Practice?</h3>
            <p className="text-lg mb-4 opacity-90">
              Studies have shown that patients love the instantaneous 3-D picture intraoral scanners provide and believe doctors using digital impression systems as more expert, accomplished and advanced.
            </p>
            <Link href="#contact-leasing" className="inline-block bg-white text-primary px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
              Ask About Our Leasing Program
            </Link>
          </div>
        </div>
      </section>

      {/* Payment Structure */}
      <section className="section-padding bg-light">
        <div className="container-wide max-w-4xl">
          <div className="bg-white p-8 rounded-lg shadow-lg">
            <h2 className="text-3xl font-bold mb-6 text-center">How Our Leasing Works</h2>
            
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="text-3xl">1️⃣</div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Choose Your Scanner</h3>
                  <p className="text-gray-600">
                    Select from our range of approved intraoral scanners that fit your practice needs
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="text-3xl">2️⃣</div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Set Your Monthly Payment</h3>
                  <p className="text-gray-600">
                    We'll calculate a base monthly payment with no capital expense required
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="text-3xl">3️⃣</div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Send Digital Cases</h3>
                  <p className="text-gray-600">
                    The more digital cases you submit to JD Dental Lab, the lower your monthly payment becomes
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="text-3xl">4️⃣</div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Grow Your Practice</h3>
                  <p className="text-gray-600">
                    Enjoy faster turnaround times, better accuracy, and improved patient experience
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 p-6 bg-primary/10 rounded-lg">
              <h3 className="text-xl font-bold mb-2 text-center">💡 Volume Discount Structure</h3>
              <p className="text-gray-600 text-center">
                The more cases you send, the less you pay. It's that simple! Our leasing program is designed to reward practices that embrace digital workflows.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Scanner Options */}
      <section className="section-padding bg-white">
        <div className="container-wide">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Available Scanner Options</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Choose from industry-leading intraoral scanners through our leasing program
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {scannerOptions.map((scanner, index) => (
              <div key={index} className="bg-light p-6 rounded-lg text-center">
                <div className="bg-white p-4 rounded-lg mb-4">
                  <img 
                    src={scanner.image} 
                    alt={scanner.name}
                    className="w-full h-48 object-contain"
                  />
                </div>
                <h3 className="text-xl font-bold mb-4">{scanner.name}</h3>
                <ul className="space-y-2 text-left">
                  {scanner.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-primary">✓</span>
                      <span className="text-gray-600">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="text-center mt-8">
            <Link href="/scans" className="btn-secondary inline-block">
              Learn How to Send Digital Scans →
            </Link>
          </div>
        </div>
      </section>

      {/* Benefits of Digital Workflow */}
      <section className="section-padding bg-gradient-to-b from-light to-white">
        <div className="container-wide max-w-4xl">
          <h2 className="text-4xl font-bold mb-8 text-center">Why Digitize Your Workflow?</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-bold mb-3 text-primary">⚡ Faster Turnaround</h3>
              <p className="text-gray-600">
                Digital scans reach our lab instantly—no shipping delays, no lost impressions
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-bold mb-3 text-primary">🎯 Better Accuracy</h3>
              <p className="text-gray-600">
                Eliminate distortions from traditional impressions for better-fitting restorations
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-bold mb-3 text-primary">😊 Improved Patient Experience</h3>
              <p className="text-gray-600">
                No more messy impression material—patients appreciate the modern approach
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-bold mb-3 text-primary">💾 Digital Records</h3>
              <p className="text-gray-600">
                Store patient scans digitally for easy retrieval and comparison over time
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="contact-leasing" className="section-padding bg-primary text-white">
        <div className="container-wide max-w-3xl text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to Go Digital?</h2>
          <p className="text-xl mb-8 opacity-90">
            Contact us today to learn more about our Intraoral Scanner Leasing Program and start transforming your practice
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <a href="tel:551-226-9540" className="bg-white text-primary px-8 py-4 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
              📞 Call 551-226-9540
            </a>
            <a href="mailto:info@jdlab.us" className="bg-white text-primary px-8 py-4 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
              📧 Email Us
            </a>
          </div>

          <Link href="/#contact" className="text-white underline hover:no-underline">
            Or fill out our contact form →
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  )
}

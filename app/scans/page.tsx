import Header from '@/components/Header'
import Footer from '@/components/Footer'
import PageBackground from '@/components/PageBackground'

export default function DigitalScansPage() {
  const scannerInstructions = [
    {
      id: 'itero',
      scanner: 'iTero Scanner',
      emoji: '🔷',
      options: [
        {
          title: 'Option 1',
          steps: [
            'Select "Find a Laboratory" on your iTero scanner',
            'Connect with JD Dental Lab using our Company ID: JD DENTAL LAB 20322',
            'After connecting to us as a Lab, select "JD Dental Lab" on your scanner when sending files'
          ]
        },
        {
          title: 'Option 2',
          steps: [
            'Call 800-577-8767',
            'Select Option 1',
            'Request that JD Dental Lab is added to your scanner. Identify our lab using our phone number 630-541-7666',
            'After JD Dental Lab has been added, restart your scanner',
            'After connecting to us as a Lab, select JD Dental Lab on your scanner when sending file'
          ]
        }
      ]
    },
    {
      id: '3shape',
      scanner: '3Shape Scanner',
      emoji: '🟦',
      steps: [
        {
          title: 'Step 1',
          description: 'Open Unite software → click Store.',
          note: 'Labs now can be seen and installed as Apps in the 3Shape Unite Store.'
        },
        {
          title: 'Step 2',
          description: 'Go to Labs → Type the lab name (JD Dental Lab) → click "Install"'
        },
        {
          title: 'Step 3',
          description: 'In the Unite Store, you can connect to a lab by installing its app. Installing a lab initiates the connection request process; consequently the installation of the lab is dependent on the lab\'s acceptance of the connection request.'
        },
        {
          title: 'Step 4',
          description: 'We will accept/reject incoming connection requests on the 3Shape Communicate Portal (not in the Store). The connection requests you have sent to the lab will be seen as "Pending" in the Unite Store. Once we accept the request, its status will be changed to "Installed" in the Store.'
        }
      ]
    },
    {
      id: 'cerec',
      scanner: 'Sirona/Cerec Connect',
      emoji: '🔵',
      steps: [
        'Log in to Cerec Connect at www.sirona-connect.com',
        'Select "My Cerec Connect," then "Edit Account"',
        'Under "My Account," select "My Favorite Laboratories"',
        'Type "JD Dental Lab" in the field for "Company Name," then "60515" for Zip Code',
        'Click "FIND"',
        'Check the box that says "JD Dental Lab"',
        'Click "ADD" to complete the registration',
        'When sending a case, add "Send to JD Dental Lab" in the notes'
      ]
    },
    {
      id: '3m',
      scanner: '3M True Def Scanner',
      emoji: '🟢',
      steps: [
        'Call 3M at 800-634-2449, extension 3 for digital OR extension 1 for general assistance',
        'Ask the 3M support team to be connected to JD Dental Lab in order to submit scans via the 3M True Def Scanner'
      ]
    },
    {
      id: 'carestream',
      scanner: 'Carestream Connect',
      emoji: '🟣',
      options: [
        {
          title: 'Option 1',
          steps: [
            'Email JD Dental Lab at info@jdlab.us'
          ]
        },
        {
          title: 'Option 2',
          steps: [
            'Visit Carestream Connect on your scanner',
            'Search for JD Dental Lab',
            'Add JD Dental Lab',
            'Select JD Dental Lab when submitting scans or raw .STL files',
            'Email JD Dental Lab at info@jdlab.us'
          ]
        }
      ]
    },
    {
      id: 'planmeca',
      scanner: 'Planmeca Scanner',
      emoji: '🔶',
      steps: [
        'Select "Find a Lab" option on your scanner',
        'Search for JD Dental Lab',
        'Add JD Dental Lab',
        'Select JD Dental Lab when submitting scans'
      ]
    },
    {
      id: 'medit',
      scanner: 'Medit Scanner',
      emoji: '🟠',
      steps: [
        'Log into www.meditlink.com with the administrator account',
        'Go to "Partners" on the left pane',
        'Search for "JD Dental Lab" and click the "Request Partnership" button',
        'You\'ll see that the lab has been added to the "My Partner List" with the status reflected as "Partnership Pending"'
      ]
    }
  ]

  return (
    <div className="min-h-screen">
      <PageBackground />
      <Header />
      
      <main className="section-padding bg-white">
        <div className="container-wide max-w-5xl">
          {/* Page Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              How to Send Your Digital Scans To Us
            </h1>
            <p className="text-xl text-gray-600">
              Follow the instructions below for your specific scanner system to connect with JD Dental Lab
            </p>
          </div>

          {/* Quick Contact */}
          <div className="bg-cyan-50 border-2 border-cyan-200 rounded-lg p-6 mb-12">
            <div className="flex items-center gap-4">
              <div className="text-4xl">📞</div>
              <div>
                <h3 className="text-xl font-bold text-primary mb-2">Need Help?</h3>
                <p className="text-gray-700">
                  Contact us at <a href="mailto:info@jdlab.us" className="text-primary font-semibold hover:underline">info@jdlab.us</a> or call <a href="tel:551-226-9540" className="text-primary font-semibold hover:underline">551-226-9540</a>
                </p>
              </div>
            </div>
          </div>

          {/* Scanner Instructions - Two Column Layout */}
          <div className="space-y-8">
            {scannerInstructions.map((scanner) => (
              <div key={scanner.id} className="bg-light rounded-lg p-8 border-2 border-gray-200">
                {/* Scanner Title */}
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-4xl">{scanner.emoji}</span>
                  <h2 className="text-2xl font-bold text-dark">{scanner.scanner}</h2>
                </div>

                {/* Two Column Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column - Images */}
                  <div className="bg-white rounded-lg p-6 flex items-center justify-center">
                    {scanner.id === 'itero' && (
                      <img 
                        src="/images/itero-scanner.png" 
                        alt="iTero Scanner Device"
                        className="w-full h-auto rounded-lg shadow-md"
                      />
                    )}
                    {scanner.id === '3shape' && (
                      <img 
                        src="/images/3-shape-trios-compressor.png" 
                        alt="3Shape TRIOS Scanner"
                        className="w-full h-auto rounded-lg shadow-md"
                      />
                    )}
                    {scanner.id === 'cerec' && (
                      <img 
                        src="/images/sirona-cerec.png" 
                        alt="Sirona CEREC Scanner"
                        className="w-full h-auto rounded-lg shadow-md"
                      />
                    )}
                    {scanner.id === '3m' && (
                      <img 
                        src="/images/3m-true-def.png" 
                        alt="3M True Def Scanner"
                        className="w-full h-auto rounded-lg shadow-md"
                      />
                    )}
                    {scanner.id === 'carestream' && (
                      <img 
                        src="/images/carestream-scanner.png" 
                        alt="Carestream Scanner"
                        className="w-full h-auto rounded-lg shadow-md"
                      />
                    )}
                    {scanner.id === 'planmeca' && (
                      <img 
                        src="/images/planmeca-scanner.png" 
                        alt="Planmeca Scanner"
                        className="w-full h-auto rounded-lg shadow-md"
                      />
                    )}
                    {scanner.id === 'medit' && (
                      <img 
                        src="/images/medit-i500.png" 
                        alt="Medit i500 Scanner"
                        className="w-full h-auto rounded-lg shadow-md"
                      />
                    )}
                    {scanner.id !== 'itero' && scanner.id !== '3shape' && scanner.id !== 'cerec' && scanner.id !== '3m' && scanner.id !== 'carestream' && scanner.id !== 'planmeca' && scanner.id !== 'medit' && (
                      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                        <span className="text-6xl mb-4">{scanner.emoji}</span>
                        <p className="text-center">{scanner.scanner}</p>
                      </div>
                    )}
                  </div>

                  {/* Right Column - Instructions */}
                  <div>
                    {/* Options-based layout */}
                    {scanner.options && (
                      <div className="space-y-6">
                        {scanner.options.map((option, idx) => (
                          <div key={idx} className="bg-white rounded-lg p-6">
                            <h3 className="text-lg font-bold text-primary mb-4">{option.title}</h3>
                            <ol className="space-y-3">
                              {option.steps.map((step, stepIdx) => (
                                <li key={stepIdx} className="flex gap-3">
                                  <span className="text-primary font-bold flex-shrink-0">{stepIdx + 1}.</span>
                                  <span className="text-gray-700">{step}</span>
                                </li>
                              ))}
                            </ol>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Steps-based layout - Special handling for 3Shape with images */}
                    {scanner.steps && !scanner.options && scanner.id === '3shape' && (
                      <div className="space-y-6">
                        {scanner.steps.map((step, idx) => (
                          <div key={idx} className="bg-white rounded-lg p-6">
                            <div className="flex gap-3 mb-4">
                              <span className="text-primary font-bold text-lg flex-shrink-0">{idx + 1}.</span>
                              <div>
                                {typeof step === 'string' ? (
                                  <p className="text-gray-700">{step}</p>
                                ) : (
                                  <>
                                    <p className="font-semibold text-dark mb-2">{step.title}</p>
                                    <p className="text-gray-700 mb-3">{step.description}</p>
                                    {step.note && (
                                      <p className="text-sm text-gray-600 italic mb-3">{step.note}</p>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                            {/* Step Image */}
                            <div className="mt-4 border-2 border-gray-200 rounded-lg overflow-hidden">
                              <img 
                                src={`/images/3shape-step-${idx + 1}.jpg`}
                                alt={`3Shape Scanner Step ${idx + 1}`}
                                className="w-full h-auto"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Steps-based layout - Default for other scanners */}
                    {scanner.steps && !scanner.options && scanner.id !== '3shape' && (
                      <div className="bg-white rounded-lg p-6">
                        <ol className="space-y-4">
                          {scanner.steps.map((step, idx) => (
                            <li key={idx} className="flex gap-3">
                              <span className="text-primary font-bold text-lg flex-shrink-0">{idx + 1}.</span>
                              <div>
                                {typeof step === 'string' ? (
                                  <p className="text-gray-700">{step}</p>
                                ) : (
                                  <>
                                    <p className="font-semibold text-dark mb-2">{step.title}</p>
                                    <p className="text-gray-700">{step.description}</p>
                                    {step.note && (
                                      <p className="text-sm text-gray-600 italic mt-2">{step.note}</p>
                                    )}
                                  </>
                                )}
                              </div>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom CTA */}
          <div className="mt-12 text-center bg-gradient-to-r from-primary to-secondary text-white rounded-lg p-8">
            <h3 className="text-2xl font-bold mb-4">Still Have Questions?</h3>
            <p className="text-lg mb-6">
              Our technical support team is available 24/7 to help you set up your scanner connection
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="#contact" className="px-8 py-3 bg-white text-primary rounded-lg font-semibold hover:bg-gray-100 transition-colors">
                Contact Support
              </a>
              <a href="/" className="px-8 py-3 bg-transparent border-2 border-white text-white rounded-lg font-semibold hover:bg-white hover:text-primary transition-colors">
                Back to Home
              </a>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

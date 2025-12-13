'use client'

import { useEffect, useState } from 'react'

export default function Hero() {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  const scrollToContact = () => {
    const contactSection = document.getElementById('contact')
    if (contactSection) {
      contactSection.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <section className="relative w-full min-h-screen flex items-center justify-center overflow-hidden">
      {/* Modern Background with Animated Elements */}
      <div className="absolute inset-0 z-0">
        {/* Base gradient background - bright and clean */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-cyan-50 to-white"></div>
        
        {/* Animated gradient orbs - only render on client */}
        {isClient && (
          <>
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/15 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/15 rounded-full blur-3xl animate-pulse animation-delay-2000"></div>
            <div className="absolute top-1/2 right-0 w-96 h-96 bg-accent/8 rounded-full blur-3xl animate-pulse animation-delay-4000"></div>
          </>
        )}
        
        {/* Tech pattern overlay - subtle grid */}
        <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(0deg,transparent_24%,rgba(0,102,204,.08)_25%,rgba(0,102,204,.08)_26%,transparent_27%,transparent_74%,rgba(0,102,204,.08)_75%,rgba(0,102,204,.08)_76%,transparent_77%,transparent),linear-gradient(90deg,transparent_24%,rgba(0,102,204,.08)_25%,rgba(0,102,204,.08)_26%,transparent_27%,transparent_74%,rgba(0,102,204,.08)_75%,rgba(0,102,204,.08)_76%,transparent_77%,transparent)] bg-[length:50px_50px]"></div>
        
        {/* Radial gradient from center */}
        <div className="absolute inset-0 bg-radial-gradient" style={{backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(0, 102, 204, 0.08), transparent 70%)'}}></div>
      </div>

      {/* Content */}
      <div className="relative z-10 container-wide text-center section-padding">
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 leading-tight text-dark">
          JD Dental Lab
          <span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary via-secondary to-accent mt-2">
            Global Innovation
          </span>
        </h1>
        <p className="text-lg sm:text-xl text-gray-700 max-w-3xl mx-auto mb-8">
          Revolutionizing dental and medical device manufacturing with cutting-edge digital technology, 
          automated workflows, and worldwide reach. Deliver excellence to patients globally.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button className="btn-primary hover:scale-105 transition-transform shadow-lg">
            Explore Services
          </button>
          <button 
            onClick={scrollToContact}
            className="px-6 py-3 border-2 border-secondary text-secondary rounded-lg font-semibold hover:bg-secondary hover:text-white transition-all hover:scale-105 shadow-lg"
          >
            Request Demo
          </button>
        </div>
      </div>
    </section>
  )
}

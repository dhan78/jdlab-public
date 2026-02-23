'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import HeroCoverflow from './HeroCoverflow'

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
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/JDLab_background.png"
          alt="Dental lab background with robotic arm and tooth model"
          fill
          className="object-cover"
          priority
          quality={85}
        />
        {/* White overlay for text readability */}
        <div className="absolute inset-0 bg-white/75"></div>
        
        {/* Subtle gradient overlay for depth */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-transparent to-white/60"></div>
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
          <button
            onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })}
            className="btn-primary hover:scale-105 transition-transform shadow-lg"
          >
            Explore Services
          </button>
          <button 
            onClick={scrollToContact}
            className="px-6 py-3 border-2 border-secondary text-secondary rounded-lg font-semibold hover:bg-secondary hover:text-white transition-all hover:scale-105 shadow-lg"
          >
            Request Demo
          </button>
        </div>

        {/* Coverflow Gallery */}
        {isClient && (
          <div className="mt-12 sm:mt-16">
            <HeroCoverflow />
          </div>
        )}
      </div>
    </section>
  )
}

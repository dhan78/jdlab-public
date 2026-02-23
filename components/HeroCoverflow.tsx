'use client'

import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'

const labImages = [
  { src: '/images/hero-dental-robotics.jpg', alt: 'Scientists in lab coats analyzing robotic arm for dental technology' },
  { src: '/images/hero-dental-implant.jpg', alt: 'Precision dental implant model with jaw structure' },
  { src: '/images/hero-dental-3dprint.jpg', alt: '3D printed dental model in laboratory setting' },
  { src: '/images/hero-robotic-surgery.jpg', alt: 'Scientist supervising robotic surgical equipment in dental technology' },
  { src: '/images/hero-medical-device.jpg', alt: 'Medical device technician crafting orthotic in workshop' },
  { src: '/images/hero-robot-lab.jpg', alt: 'Robotic automation in precision lab environment' },
]

export default function HeroCoverflow() {
  const [activeIndex, setActiveIndex] = useState(0)
  const total = labImages.length

  const next = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % total)
  }, [total])

  const prev = useCallback(() => {
    setActiveIndex((prev) => (prev - 1 + total) % total)
  }, [total])

  // Auto-rotate every 4 seconds
  useEffect(() => {
    const timer = setInterval(next, 4000)
    return () => clearInterval(timer)
  }, [next])

  // Given an index, compute the position relative to active
  const getOffset = (index: number) => {
    let diff = index - activeIndex
    // Wrap around for circular coverflow
    if (diff > Math.floor(total / 2)) diff -= total
    if (diff < -Math.floor(total / 2)) diff += total
    return diff
  }

  return (
    <div className="relative w-full max-w-4xl mx-auto h-56 sm:h-64 md:h-72 lg:h-80">
      {/* Coverflow container with perspective */}
      <div className="coverflow-container">
        {labImages.map((img, index) => {
          const offset = getOffset(index)
          const isActive = offset === 0
          const absOffset = Math.abs(offset)

          // Hide images more than 2 away
          if (absOffset > 2) return null

          // Compute transform values
          const translateX = offset * 220
          const translateZ = isActive ? 0 : -150 - absOffset * 50
          const rotateY = offset * -35
          const scale = isActive ? 1 : 0.75 - absOffset * 0.05
          const opacity = isActive ? 1 : 0.6 - absOffset * 0.15
          const zIndex = 10 - absOffset

          return (
            <div
              key={index}
              className="coverflow-slide"
              style={{
                transform: `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
                opacity,
                zIndex,
              }}
              onClick={() => setActiveIndex(index)}
            >
              <div className="relative w-64 sm:w-72 md:w-80 h-44 sm:h-52 md:h-60 rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/20">
                <Image
                  src={img.src}
                  alt={img.alt}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 256px, (max-width: 768px) 288px, 320px"
                  priority={isActive}
                />
                {/* Glossy reflection overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/30 pointer-events-none" />
              </div>
            </div>
          )
        })}
      </div>

      {/* Navigation arrows */}
      <button
        onClick={prev}
        className="absolute left-0 sm:left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm shadow-lg flex items-center justify-center text-primary hover:bg-white transition-colors"
        aria-label="Previous image"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button
        onClick={next}
        className="absolute right-0 sm:right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm shadow-lg flex items-center justify-center text-primary hover:bg-white transition-colors"
        aria-label="Next image"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Dot indicators */}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-2 z-20">
        {labImages.map((_, index) => (
          <button
            key={index}
            onClick={() => setActiveIndex(index)}
            className={`w-2 h-2 rounded-full transition-all ${
              index === activeIndex
                ? 'bg-primary w-6'
                : 'bg-gray-400/50 hover:bg-gray-400'
            }`}
            aria-label={`Go to image ${index + 1}`}
          />
        ))}
      </div>
    </div>
  )
}

import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'JD Dental Lab | Global Dental & Medical Devices',
  description: 'JD Dental Lab - Leading digital dental and medical devices lab with global reach and automated workflow processes. Serving dental professionals worldwide.',
  keywords: 'dental lab, medical devices, digital dentistry, CAD/CAM, automation',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}

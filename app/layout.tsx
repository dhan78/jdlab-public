import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'JD Dental Lab | Global Dental & Medical Devices',
  description: 'JD Dental Lab - Leading digital dental and medical devices lab with global reach and automated workflow processes. Serving dental professionals worldwide.',
  keywords: 'dental lab, medical devices, digital dentistry, CAD/CAM, automation',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      { rel: 'android-chrome', url: '/android-chrome-192x192.png', sizes: '192x192' },
      { rel: 'android-chrome', url: '/android-chrome-512x512.png', sizes: '512x512' },
    ],
  },
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

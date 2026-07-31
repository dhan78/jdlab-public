import type { NextConfig } from 'next'

const isProd = process.env.NODE_ENV === 'production'

// Baseline security headers. A strict CSP is intentionally omitted here because
// Next's inline runtime needs careful nonce wiring — add it once verified.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  // HSTS only in production (HTTPS); avoids pinning HTTP dev to HTTPS.
  ...(isProd
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]
    : []),
]

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  // Next 16 requires declaring any non-default next/image quality values.
  images: {
    qualities: [75, 85],
  },
  typescript: {
    tsconfigPath: './tsconfig.json',
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig

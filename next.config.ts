import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  typescript: {
    tsconfigPath: './tsconfig.json',
  },
}

export default nextConfig

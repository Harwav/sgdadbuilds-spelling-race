import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: false,
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
  devIndicators: false,
}

export default nextConfig

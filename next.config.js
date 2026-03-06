
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Force a fresh build to resolve build errors and potential 404s.
  // Build Timestamp: 2026-03-01-12-00
  reactStrictMode: true,
  allowedDevOrigins: [
    "https://*.cloudworkstations.dev",
    "https://*.cluster-edb2jv34dnhjisxuq5m7l37ccy.cloudworkstations.dev",
    "*.cloudworkstations.dev",
    "*.cluster-edb2jv34dnhjisxuq5m7l37ccy.cloudworkstations.dev"
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
    ],
  },
};

module.exports = nextConfig;

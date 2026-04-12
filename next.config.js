/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output is required for many App Hosting environments
  output: 'standalone',
  // Force a fresh build to resolve bundle sync errors (ChunkLoadError).
  // Build Timestamp: 2026-04-12-20-30
  reactStrictMode: true,
  allowedDevOrigins: [
    "https://*.cloudworkstations.dev",
    "https://*.cluster-edb2jv34dnhjisxuq5m7l37ccy.cloudworkstations.dev",
    "*.cloudworkstations.dev",
    "*.cluster-edb2jv34dnhjisxuq5m7l37ccy.cloudworkstations.dev",
    "6000-firebase-studio-1757160189526.cluster-edb2jv34dnhjisxuq5m7l37ccy.cloudworkstations.dev"
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

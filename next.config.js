
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Force a fresh build to resolve MODULE_NOT_FOUND and cross-origin issues.
  // Cache-buster: 2026-02-26-20-00
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

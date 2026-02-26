
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Force a fresh build to resolve MODULE_NOT_FOUND and cross-origin issues.
  // Update: Explicitly allowing broad workstation origin to resolve HMR blocks.
  // Cache-buster: 2026-02-26-06-00
  reactStrictMode: true,
  allowedDevOrigins: [
    "https://*.cloudworkstations.dev",
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

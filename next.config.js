
// Busting the cache to resolve a "Cannot find module" build error.
/** @type {import('next').NextConfig} */
const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  fallbacks: {
    document: '/_offline',
  },
});

const nextConfig = {
  // Triggering a rebuild to clear a potentially corrupted cache.
  // Adding another comment to force a rebuild again to resolve 404s.
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  devIndicators: {
    allowedDevOrigins: ['*.cloudworkstations.dev'],
  },
};

module.exports = withPWA(nextConfig);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Force rebuild to clear corrupted cache.
  // Invalidate cache again.
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
  devIndicators: {
    allowedDevOrigins: ["https://*.cloudworkstations.dev"],
  },
};

module.exports = nextConfig;

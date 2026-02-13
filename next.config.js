/** @type {import('next').NextConfig} */
const nextConfig = {
  // Force cache invalidation to resolve module loading error
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

module.exports = nextConfig;

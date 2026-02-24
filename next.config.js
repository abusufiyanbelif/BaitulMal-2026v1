
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Force a reload by adding a comment.
  // Force a cache invalidation again.
  // Force a cache invalidation one more time to fix ChunkLoadError.
  reactStrictMode: true,
  allowedDevOrigins: [
    "https://*.cloudworkstations.dev"
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

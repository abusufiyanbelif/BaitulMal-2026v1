/** @type {import('next').NextConfig} */
const nextConfig = {
  // Force a reload by adding a comment.
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

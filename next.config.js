
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Force a fresh build to resolve MODULE_NOT_FOUND and cross-origin issues.
  // Refreshing build cache to fix compilation hang and allowedDevOrigins errors.
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

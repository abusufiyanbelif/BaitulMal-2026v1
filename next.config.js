/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disabling strict mode as a diagnostic step to stabilize the dev server.
  reactStrictMode: false,
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
  // Cache-busting comment to force a clean rebuild.
};

module.exports = nextConfig;

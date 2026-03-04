import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Baitulmal Samajik Sanstha Solapur',
    short_name: 'Baitulmal',
    description: 'Managing and tracking community support campaigns efficiently.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1FB278', // Matching HSL 160 70% 40%
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
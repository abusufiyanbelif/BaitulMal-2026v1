
import type { Metadata, Viewport } from 'next';
import './globals.css';
import * as React from 'react';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: {
    template: '%s | Baitulmal Samajik Sanstha Solapur',
    default: 'Baitulmal Samajik Sanstha Solapur',
  },
  description: 'Managing and tracking community support campaigns efficiently.',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#16a34a',
};


export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

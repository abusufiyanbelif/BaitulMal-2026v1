'use client';

import { BrandedLoader } from '@/components/branded-loader';

/**
 * Global Next.js page-level loading state.
 */
export default function Loading() {
  return <BrandedLoader message="Loading Page Resources..." />;
}
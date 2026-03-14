'use client';

import { BrandedLoader } from '@/components/branded-loader';

/**
 * Global Next.js page-level loading state.
 * Status message follows the professional Title Case standard.
 */
export default function Loading() {
  return <BrandedLoader message="Loading Page Resources..." />;
}
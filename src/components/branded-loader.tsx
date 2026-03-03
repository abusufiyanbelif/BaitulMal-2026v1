'use client';

import { useBranding } from '@/hooks/use-branding';
import Image from 'next/image';
import { TempLogo } from './temp-logo';

/**
 * A refined branded loading screen that displays the organizational logo with a smooth zoom animation.
 * Optimized to remove redundant circles and prevent watermark overlap.
 */
export function BrandedLoader() {
  const { brandingSettings, isLoading: isBrandingLoading } = useBranding();

  const validLogoUrl = brandingSettings?.logoUrl?.trim() ? brandingSettings.logoUrl : null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="relative z-10 flex flex-col items-center">
        {/* Only the logo with zoom animation is shown for a premium buffering feel */}
        {!isBrandingLoading && validLogoUrl ? (
          <div className="relative w-[120px] h-[120px] animate-zoom-in-out">
            <Image
              src={`/api/image-proxy?url=${encodeURIComponent(validLogoUrl)}`}
              alt="Loading..."
              fill
              sizes="120px"
              className="object-contain"
              priority
            />
          </div>
        ) : (
          <div className="w-[120px] h-[120px] animate-zoom-in-out">
              <TempLogo />
          </div>
        )}
      </div>
    </div>
  );
}

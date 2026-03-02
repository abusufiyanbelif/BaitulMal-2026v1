'use client';

import { Loader2 } from 'lucide-react';
import { useBranding } from '@/hooks/use-branding';
import Image from 'next/image';
import { TempLogo } from './temp-logo';
import { Watermark } from './watermark';

export function BrandedLoader() {
  const { brandingSettings, isLoading: isBrandingLoading } = useBranding();

  const validLogoUrl = brandingSettings?.logoUrl?.trim() ? brandingSettings.logoUrl : null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      {/* Include the watermark inside the loader to ensure it shows during initial app boot */}
      <Watermark />
      
      <div className="relative z-10 flex flex-col items-center gap-4">
        {isBrandingLoading ? (
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        ) : validLogoUrl ? (
          <Image
            src={`/api/image-proxy?url=${encodeURIComponent(validLogoUrl)}`}
            alt="Loading..."
            width={120}
            height={120}
            className="animate-zoom-in-out"
            priority
          />
        ) : (
          <div className="w-[120px] h-[120px] animate-zoom-in-out">
              <TempLogo />
          </div>
        )}
        <Loader2 className="h-6 w-6 animate-spin text-primary/60" />
      </div>
    </div>
  );
}

'use client';

import { Loader2 } from 'lucide-react';
import { useBranding } from '@/hooks/use-branding';
import Image from 'next/image';
import { TempLogo } from './temp-logo';

export function BrandedLoader() {
  const { brandingSettings, isLoading: isBrandingLoading } = useBranding();

  const validLogoUrl = brandingSettings?.logoUrl?.trim() ? brandingSettings.logoUrl : null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      {isBrandingLoading ? (
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      ) : validLogoUrl ? (
        <Image
          src={`/api/image-proxy?url=${encodeURIComponent(validLogoUrl)}`}
          alt="Loading..."
          width={200}
          height={200}
          className="animate-zoom-in-out"
          priority
        />
      ) : (
        <div className="w-[200px] h-[200px] animate-zoom-in-out">
            <TempLogo />
        </div>
      )}
    </div>
  );
}

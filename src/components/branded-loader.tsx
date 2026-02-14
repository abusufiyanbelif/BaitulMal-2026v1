
'use client';
import { useBranding } from '@/hooks/use-branding';
import { TempLogo } from '@/components/temp-logo';
import Image from 'next/image';

export function BrandedLoader() {
    const { brandingSettings } = useBranding();
    const validLogoUrl = brandingSettings?.logoUrl?.trim() ? brandingSettings.logoUrl : null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background">
            <div className="animate-logo-in">
                {validLogoUrl ? (
                     <Image
                        src={`/api/image-proxy?url=${encodeURIComponent(validLogoUrl)}`}
                        alt="Logo"
                        width={brandingSettings?.logoWidth || 150}
                        height={brandingSettings?.logoHeight || 75}
                        className="object-contain"
                        priority
                     />
                ) : (
                    <div className="w-40 h-40">
                      <TempLogo />
                    </div>
                )}
            </div>
        </div>
    );
}

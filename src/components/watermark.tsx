'use client';
import { useBranding } from '@/hooks/use-branding';
import { cn } from '@/lib/utils';

export function Watermark() {
    const { brandingSettings, isLoading: isBrandingLoading } = useBranding();
    
    if (isBrandingLoading) {
        return null;
    }
    
    const validLogoUrl = brandingSettings?.logoUrl?.trim() ? brandingSettings.logoUrl : null;

    if (!validLogoUrl) {
        return null;
    }

    return (
        <div className="fixed inset-0 -z-10 flex items-center justify-center pointer-events-none opacity-[0.12] mix-blend-multiply grayscale brightness-110 contrast-125">
            <img
                src={`/api/image-proxy?url=${encodeURIComponent(validLogoUrl)}`}
                alt="Watermark"
                width={600}
                height={600}
                className={cn(
                    "object-contain transition-transform duration-300"
                )}
            />
        </div>
    );
}
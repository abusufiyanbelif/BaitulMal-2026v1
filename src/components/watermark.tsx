'use client';
import { useBranding } from '@/hooks/use-branding';
import { cn } from '@/lib/utils';

export function Watermark() {
    const { brandingSettings, isLoading: isBrandingLoading } = useBranding();
    
    const validLogoUrl = brandingSettings?.logoUrl?.trim() ? brandingSettings.logoUrl : null;

    if (!validLogoUrl && !isBrandingLoading) {
        return null;
    }

    return (
        <div className="fixed inset-0 -z-10 flex items-center justify-center pointer-events-none mix-blend-multiply overflow-hidden select-none">
            {validLogoUrl && (
                <img
                    src={`/api/image-proxy?url=${encodeURIComponent(validLogoUrl)}`}
                    alt="Branding Watermark"
                    className={cn(
                        "w-auto h-auto max-w-[85vw] max-h-[85vh] object-contain transition-opacity duration-1000 ease-in-out pointer-events-none",
                        validLogoUrl ? "opacity-100" : "opacity-0"
                    )}
                />
            )}
        </div>
    );
}
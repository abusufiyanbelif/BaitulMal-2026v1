'use client';
import { useBranding } from '@/hooks/use-branding';
import { cn } from '@/lib/utils';

export function Watermark() {
    const { brandingSettings, isLoading: isBrandingLoading } = useBranding();
    
    // We want the watermark to be part of the DOM even while loading 
    // to ensure transitions are smooth, but it only renders the image once the URL is available.
    const validLogoUrl = brandingSettings?.logoUrl?.trim() ? brandingSettings.logoUrl : null;

    if (!validLogoUrl && !isBrandingLoading) {
        return null;
    }

    return (
        <div className="fixed inset-0 -z-10 flex items-center justify-center pointer-events-none opacity-[0.10] mix-blend-multiply overflow-hidden">
            {validLogoUrl && (
                <img
                    src={`/api/image-proxy?url=${encodeURIComponent(validLogoUrl)}`}
                    alt="Branding Watermark"
                    className={cn(
                        "w-auto h-auto max-w-[80vw] max-h-[80vh] object-contain transition-opacity duration-700 ease-in-out",
                        validLogoUrl ? "opacity-100" : "opacity-0"
                    )}
                />
            )}
        </div>
    );
}

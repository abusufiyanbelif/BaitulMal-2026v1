'use client';
import { useBranding } from '@/hooks/use-branding';
import { cn } from '@/lib/utils';

/**
 * Watermark - Subtle background branding that "blooms" into view.
 */
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
                    alt="Institutional Branding"
                    className={cn(
                        "w-auto h-auto max-w-[85vw] max-h-[85vh] object-contain transition-all duration-1000 ease-in-out pointer-events-none",
                        validLogoUrl ? "opacity-100 scale-100" : "opacity-0 scale-95"
                    )}
                />
            )}
        </div>
    );
}

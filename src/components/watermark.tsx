'use client';
import { useBranding } from '@/hooks/use-branding';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

/**
 * Watermark - Subtle background branding that "blooms" into view on page load.
 * Features synchronized scaling and opacity transitions for a premium feel.
 */
export function Watermark() {
    const { brandingSettings, isLoading: isBrandingLoading } = useBranding();
    const [isLoaded, setIsLoaded] = useState(false);
    
    useEffect(() => {
        if (!isBrandingLoading && brandingSettings?.logoUrl) {
            const timer = setTimeout(() => setIsLoaded(true), 100);
            return () => clearTimeout(timer);
        }
    }, [isBrandingLoading, brandingSettings?.logoUrl]);

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
                        isLoaded ? "opacity-[0.08] scale-100" : "opacity-0 scale-95 translate-y-4"
                    )}
                />
            )}
        </div>
    );
}
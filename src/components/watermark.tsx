
'use client';
import { useBranding } from '@/hooks/use-branding';

export function Watermark() {
    const { brandingSettings, isLoading } = useBranding();
    
    // Show a fallback or nothing while loading
    if (isLoading) {
        return null;
    }
    
    const validLogoUrl = brandingSettings?.logoUrl?.trim() ? brandingSettings.logoUrl : null;

    if (!validLogoUrl) {
        return null;
    }

    return (
        <div className="fixed inset-0 -z-10 flex items-center justify-center pointer-events-none opacity-[0.05]">
            <img
                src={`/api/image-proxy?url=${encodeURIComponent(validLogoUrl)}`}
                alt="Watermark"
                width={500}
                height={500}
                className="object-contain"
            />
        </div>
    );
}


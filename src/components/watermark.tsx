
'use client';
import { useBranding } from '@/hooks/use-branding';
import { useSession } from '@/hooks/use-session';
import { cn } from '@/lib/utils';

export function Watermark() {
    const { brandingSettings, isLoading: isBrandingLoading } = useBranding();
    const { isLoading: isSessionLoading } = useSession();
    
    // Show a fallback or nothing while loading brand settings
    if (isBrandingLoading) {
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
                className={cn(
                    "object-contain transition-transform duration-300"
                )}
            />
        </div>
    );
}

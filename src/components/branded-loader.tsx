
'use client';
import { useBranding } from '@/hooks/use-branding';
import { TempLogo } from '@/components/temp-logo';
import Image from 'next/image';
import Lottie from 'lottie-react';
import React, { useEffect, useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

export function BrandedLoader() {
    const { brandingSettings, isLoading: isBrandingLoading } = useBranding();
    const [animationData, setAnimationData] = useState(null);
    const isMobile = useIsMobile();

    const loadingAnimationUrl = !isBrandingLoading && brandingSettings?.loadingAnimationUrl?.trim() ? brandingSettings.loadingAnimationUrl : null;
    const validLogoUrl = !isBrandingLoading && brandingSettings?.logoUrl?.trim() ? brandingSettings.logoUrl : null;

    useEffect(() => {
        if (loadingAnimationUrl) {
            fetch(loadingAnimationUrl)
                .then(res => res.json())
                .then(data => setAnimationData(data))
                .catch(err => {
                    console.error("Failed to load Lottie animation:", err);
                    setAnimationData(null);
                });
        }
    }, [loadingAnimationUrl]);
    
    const logoContainerWidth = 200;
    const logoContainerHeight = 200;
    
    const animationContainerSize = Math.max(logoContainerWidth, logoContainerHeight) * 1.5;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background">
            <div className="relative flex items-center justify-center">
                <div 
                    className="flex items-center justify-center animate-zoom-in-out"
                    style={{ 
                        width: `${logoContainerWidth}px`, 
                        height: `${logoContainerHeight}px`
                    }}
                >
                    {isBrandingLoading || !validLogoUrl ? (
                         <div className="w-full h-full">
                           <TempLogo />
                         </div>
                    ) : (
                         <Image
                            src={`/api/image-proxy?url=${encodeURIComponent(validLogoUrl)}`}
                            alt="Logo"
                            width={logoContainerWidth}
                            height={logoContainerHeight}
                            className="object-contain"
                            priority
                         />
                    )}
                </div>

                {loadingAnimationUrl && animationData && (
                    <div 
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                        style={{ width: animationContainerSize, height: animationContainerSize }}
                    >
                        <Lottie animationData={animationData} loop={true} />
                    </div>
                )}
            </div>
        </div>
    );
}

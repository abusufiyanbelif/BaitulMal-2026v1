'use client';
import { useBranding } from '@/hooks/use-branding';
import { TempLogo } from '@/components/temp-logo';
import Image from 'next/image';
import Lottie from 'lottie-react';
import React, { useEffect, useState } from 'react';

export function BrandedLoader() {
    const { brandingSettings, isLoading: isBrandingLoading } = useBranding();
    const [animationData, setAnimationData] = useState(null);

    const loadingAnimationUrl = brandingSettings?.loadingAnimationUrl?.trim() ? brandingSettings.loadingAnimationUrl : null;
    const validLogoUrl = brandingSettings?.logoUrl?.trim() ? brandingSettings.logoUrl : null;

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

    if (isBrandingLoading) {
        return <div className="fixed inset-0 z-[9999] bg-background"></div>;
    }
    
    const logoWidth = brandingSettings?.logoWidth || 150;
    const logoHeight = brandingSettings?.logoHeight || 75;
    
    const animationContainerSize = Math.max(logoWidth, logoHeight) * 1.5;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background">
            <div className="relative flex items-center justify-center">
                <div 
                    className="animate-pulse-scale flex items-center justify-center"
                    style={{ 
                        width: `${logoWidth}px`, 
                        height: `${logoHeight}px`
                    }}
                >
                    {validLogoUrl ? (
                         <Image
                            src={`/api/image-proxy?url=${encodeURIComponent(validLogoUrl)}`}
                            alt="Logo"
                            width={logoWidth}
                            height={logoHeight}
                            className="object-contain"
                            priority
                         />
                    ) : !loadingAnimationUrl ? (
                         <div className="w-40 h-40">
                           <TempLogo />
                         </div>
                    ) : null }
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

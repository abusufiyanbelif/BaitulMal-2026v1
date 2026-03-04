'use client';

import { useBranding } from '@/hooks/use-branding';
import Image from 'next/image';
import { Progress } from './ui/progress';

/**
 * A refined branded loading screen that displays the organizational logo with a smooth zoom animation.
 * Supports deterministic progress tracking with percentage labels and status messages.
 */
export function BrandedLoader({ message = "Initializing system...", progress }: { message?: string, progress?: number }) {
  const { brandingSettings, isLoading: isBrandingLoading } = useBranding();

  const validLogoUrl = brandingSettings?.logoUrl?.trim() ? brandingSettings.logoUrl : null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/90 backdrop-blur-md">
      <div className="relative z-10 flex flex-col items-center gap-6 w-full max-w-xs px-4">
        {/* Logo Container - Only shown if available */}
        {!isBrandingLoading && validLogoUrl && (
          <div className="relative w-24 h-24 animate-zoom-in-out">
            <Image
              src={`/api/image-proxy?url=${encodeURIComponent(validLogoUrl)}`}
              alt="Loading..."
              fill
              sizes="96px"
              className="object-contain"
              priority
            />
          </div>
        )}

        {/* Status Message & Progress */}
        <div className="flex flex-col items-center gap-3 w-full text-center">
          <p className="text-sm font-bold text-primary animate-pulse tracking-tight">
            {message} {progress !== undefined && <span className="ml-1 text-xs">({Math.round(progress)}%)</span>}
          </p>
          <Progress value={progress} className="h-1.5 w-full bg-primary/10" />
        </div>
      </div>
    </div>
  );
}

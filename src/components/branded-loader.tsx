'use client';

import { useBranding } from '@/hooks/use-branding';
import Image from 'next/image';
import { Progress } from './ui/progress';
import { cn } from '@/lib/utils';

/**
 * A refined branded loading screen that displays the organizational logo with a smooth zoom animation.
 * Supports deterministic progress tracking with percentage labels and status messages.
 */
export function BrandedLoader({ message = "Initializing system...", progress }: { message?: string, progress?: number }) {
  const { brandingSettings, isLoading: isBrandingLoading } = useBranding();

  const validLogoUrl = brandingSettings?.logoUrl?.trim() ? brandingSettings.logoUrl : null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 backdrop-blur-md">
      <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-sm px-6">
        {/* Logo Container - Displays fallback if still loading or missing */}
        <div className="relative w-28 h-28 flex items-center justify-center">
          {validLogoUrl ? (
            <div className="relative w-full h-full animate-zoom-in-out">
              <Image
                src={`/api/image-proxy?url=${encodeURIComponent(validLogoUrl)}`}
                alt="Loading..."
                fill
                sizes="112px"
                className="object-contain"
                priority
              />
            </div>
          ) : (
            <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center animate-pulse">
              <span className="text-primary font-black text-2xl">B</span>
            </div>
          )}
        </div>

        {/* Status Message & Progress */}
        <div className="flex flex-col items-center gap-4 w-full text-center">
          <div className="space-y-1">
            <p className="text-sm font-bold text-primary tracking-tight">
              {message}
            </p>
            {progress !== undefined && (
              <p className="text-[10px] font-black text-primary/60 uppercase tracking-widest animate-pulse">
                {Math.round(progress)}% Complete
              </p>
            )}
          </div>
          <div className="w-full h-2 rounded-full bg-primary/10 overflow-hidden border border-primary/5">
            <Progress value={progress} className="h-full bg-primary transition-all duration-500 ease-out" />
          </div>
        </div>
      </div>
    </div>
  );
}
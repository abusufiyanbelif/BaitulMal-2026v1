'use client';

import { useFirebase } from '@/firebase/provider';
import Image from 'next/image';
import { Progress } from './ui/progress';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import type { BrandingSettings } from '@/lib/types';

/**
 * Branded Loader - Displays the organizational logo.
 * Safely handles null context during initialization.
 */
export function BrandedLoader({ message = "Loading...", progress }: { message?: string, progress?: number }) {
  const firebase = useFirebase();
  const [branding, setBranding] = useState<BrandingSettings | null>(null);

  useEffect(() => {
    if (firebase?.firestore) {
      const docRef = doc(firebase.firestore, 'settings', 'branding');
      getDoc(docRef).then(snap => {
        if (snap.exists()) setBranding(snap.data() as BrandingSettings);
      });
    }
  }, [firebase?.firestore]);

  const validLogoUrl = branding?.logoUrl?.trim() ? branding.logoUrl : null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 backdrop-blur-md">
      <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-sm px-6">
        {/* Logo Container */}
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
            <div className="h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          )}
        </div>

        {/* Status Message & Progress */}
        <div className="flex flex-col items-center gap-4 w-full text-center">
          <div className="space-y-1">
            <p className="text-sm font-bold text-primary tracking-tight">
              {message}
            </p>
            {progress !== undefined && (
              <p className="text-[10px] font-bold text-primary/60 tracking-tight animate-pulse">
                {Math.round(progress)}% Complete
              </p>
            )}
          </div>
          <div className="w-full h-1.5 rounded-full bg-primary/10 overflow-hidden border border-primary/5">
            <Progress value={progress} className="h-full bg-primary transition-all duration-500 ease-out" />
          </div>
        </div>
      </div>
    </div>
  );
}

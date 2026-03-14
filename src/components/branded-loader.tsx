'use client';

import { useFirebase } from '@/firebase/provider';
import Image from 'next/image';
import { Progress } from './ui/progress';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import type { BrandingSettings } from '@/lib/types';

/**
 * Branded Loader - Displays the organizational logo with premium high-fidelity animations.
 * Provides synchronized visual feedback for both startup and long-running buffer actions.
 */
export function BrandedLoader({ message = "Synchronizing...", progress }: { message?: string, progress?: number }) {
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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 backdrop-blur-md transition-all duration-700 animate-in fade-in">
      <div className="relative z-10 flex flex-col items-center gap-10 w-full max-w-sm px-8 animate-fade-in-zoom">
        
        {/* Institutional Logo Hub with Scale-Pulse Effect */}
        <div className="relative w-36 h-32 flex items-center justify-center">
          {validLogoUrl ? (
            <div className="relative w-full h-full animate-zoom-in-out">
              <Image
                src={`/api/image-proxy?url=${encodeURIComponent(validLogoUrl)}`}
                alt="Institutional Hub"
                fill
                sizes="144px"
                className="object-contain drop-shadow-2xl"
                priority
              />
            </div>
          ) : (
            <div className="h-16 w-16 rounded-full border-4 border-primary/10 border-t-primary animate-spin" />
          )}
        </div>

        {/* Dynamic Status Feedback */}
        <div className="flex flex-col items-center gap-5 w-full text-center">
          <div className="space-y-1.5">
            <p className="text-sm font-bold text-primary tracking-tight">
              {message}
            </p>
            {progress !== undefined && (
              <p className="text-[10px] font-black text-primary/40 tracking-widest animate-pulse uppercase">
                {Math.round(progress)}% Secured
              </p>
            )}
          </div>
          
          <div className="w-full h-1 rounded-full bg-primary/5 overflow-hidden border border-primary/10 shadow-inner relative">
            <Progress 
                value={progress ?? 33} 
                className={cn(
                    "h-full bg-primary transition-all duration-700 ease-out",
                    progress === undefined && "animate-pulse"
                )} 
            />
          </div>
        </div>
      </div>
    </div>
  );
}
'use client';

import { useFirebase } from '@/firebase/provider';
import Image from 'next/image';
import { Progress } from './ui/progress';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import type { BrandingSettings } from '@/lib/types';

/**
 * Branded Loader - High-fidelity organizational feedback hub.
 * Re-engineered for snappy performance and Title Case typography.
 */
export function BrandedLoader({ message = "Updating Your Organization Records...", progress }: { message?: string, progress?: number }) {
  const firebase = useFirebase();
  const [branding, setBranding] = useState<BrandingSettings | null>(null);
  const [simulatedProgress, setSimulatedProgress] = useState(0);
  const [stage, setStage] = useState(0);

  const stages = [
    "Authenticating Secure Session...",
    "Synchronizing With Cloud Vault...",
    "Fetching Organization Branding...",
    "Validating Verification Protocols...",
    "Hydrating Dynamic Components...",
    "Securing Contribution Records...",
    "Rendering System Assets...",
    "Finalizing Interface Layouts...",
    "Optimizing Database Stream..."
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setSimulatedProgress(old => {
        if (old >= 95) {
          clearInterval(timer);
          return old;
        }
        const diff = Math.random() * 10;
        return Math.min(old + diff, 95);
      });
      setStage(s => (s + 1) % stages.length);
    }, 800);

    return () => clearInterval(timer);
  }, [stages.length]);

  useEffect(() => {
    if (firebase?.firestore) {
      const docRef = doc(firebase.firestore, 'settings', 'branding');
      
      const timeoutId = setTimeout(() => {
        console.warn('[BrandedLoader] Branding fetch timed out.');
      }, 5000);

      getDoc(docRef).then(snap => {
        clearTimeout(timeoutId);
        if (snap.exists()) setBranding(snap.data() as BrandingSettings);
      }).catch(err => {
        clearTimeout(timeoutId);
        console.error('[BrandedLoader] Branding fetch error:', err);
      });

      return () => clearTimeout(timeoutId);
    }
  }, [firebase?.firestore]);

  const validLogoUrl = branding?.logoUrl?.trim() ? branding.logoUrl : null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 backdrop-blur-md transition-opacity duration-300">
      <div className="relative z-10 flex flex-col items-center gap-10 w-full max-w-sm px-8 animate-fade-in-zoom">
        
        <div className="relative w-36 h-32 flex items-center justify-center">
          {validLogoUrl ? (
            <div className="relative w-full h-full animate-zoom-in-out">
              <Image
                src={validLogoUrl.startsWith('http') ? `/api/image-proxy?url=${encodeURIComponent(validLogoUrl)}` : validLogoUrl}
                alt="Logo"
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

        <div className="flex flex-col items-center gap-5 w-full text-center">
          <div className="space-y-1.5 h-12">
            <p className="text-sm font-bold text-primary tracking-tight animate-pulse">
              {progress === undefined ? stages[stage] : message}
            </p>
            <p className="text-[10px] font-black text-primary/40 tracking-widest uppercase">
              {Math.round(progress ?? simulatedProgress)}% Secure
            </p>
          </div>
          
          <div className="w-full h-1.5 rounded-full bg-primary/5 overflow-hidden border border-primary/10 shadow-inner relative">
            <Progress 
                value={progress ?? simulatedProgress} 
                className={cn(
                    "h-full bg-primary transition-all duration-700 ease-in-out"
                )} 
            />
          </div>
        </div>
      </div>
    </div>
  );
}

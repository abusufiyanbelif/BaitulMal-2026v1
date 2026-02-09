
'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AuthProvider } from '@/app/auth-provider';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { FirebaseContentWrapper } from '@/components/FirebaseContentWrapper';
import { AppFooter } from '@/components/app-footer';
import { Toaster } from '@/components/ui/toaster';
import { useBranding } from '@/hooks/use-branding';
import { TempLogo } from '@/components/temp-logo';
import { DocuExtractHeader } from '@/components/docu-extract-header';

function Watermark() {
    const { brandingSettings, isLoading } = useBranding();
    if (isLoading) return null;
    
    const validLogoUrl = brandingSettings?.logoUrl?.trim() ? brandingSettings.logoUrl : null;

    return (
        <div className="fixed inset-0 z-0 flex items-center justify-center pointer-events-none opacity-[0.05]">
            {validLogoUrl ? (
                <img
                    src={`/api/image-proxy?url=${encodeURIComponent(validLogoUrl)}`}
                    alt="Watermark"
                    width={500}
                    height={500}
                    className="object-contain"
                />
            ) : (
                <TempLogo />
            )}
        </div>
    );
}

export function Providers({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  
  return (
    <FirebaseClientProvider>
      <AuthProvider>
        <FirebaseContentWrapper>
          <div className="relative">
              <div className="relative z-10 flex min-h-screen flex-col">
                  <DocuExtractHeader />
                  <main className="flex-grow animate-slide-in-from-bottom" style={{ animationDelay: '300ms', animationFillMode: 'backwards' }}>
                      {children}
                  </main>
                  <AppFooter />
              </div>
              <Watermark />
          </div>
          <Toaster />
        </FirebaseContentWrapper>
      </AuthProvider>
    </FirebaseClientProvider>
  );
}

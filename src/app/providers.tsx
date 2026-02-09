
'use client';

import { ReactNode } from 'react';
import { AuthProvider } from '@/app/auth-provider';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { FirebaseContentWrapper } from '@/components/FirebaseContentWrapper';
import { AppFooter } from '@/components/app-footer';
import { Toaster } from '@/components/ui/toaster';
import { useBranding } from '@/hooks/use-branding';
import { TempLogo } from '@/components/temp-logo';
import { DocuExtractHeader } from '@/components/docu-extract-header';
import { usePathname } from 'next/navigation';


function Watermark() {
    const { brandingSettings, isLoading } = useBranding();

    if (isLoading) {
        return null;
    }
    
    const validLogoUrl = brandingSettings?.logoUrl?.trim() ? brandingSettings.logoUrl : null;

    return (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none opacity-[0.05]">
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

function MainLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const noHeaderFooterRoutes = ['/login'];

  const showLayout = !noHeaderFooterRoutes.includes(pathname);

  return (
    <div className="app-root relative">
      <div className="relative">
        {showLayout ? (
          <div className="relative flex flex-col min-h-screen">
            <DocuExtractHeader />
            <div className="flex-grow animate-slide-in-from-bottom" style={{ animationDelay: '300ms', animationFillMode: 'backwards' }}>
                {children}
            </div>
            <AppFooter />
          </div>
        ) : (
          children
        )}
      </div>
      <Watermark />
    </div>
  );
}


export function Providers({ children }: { children: ReactNode }) {
  return (
    <FirebaseClientProvider>
      <AuthProvider>
        <FirebaseContentWrapper>
          <MainLayout>
            {children}
          </MainLayout>
          <Toaster />
        </FirebaseContentWrapper>
      </AuthProvider>
    </FirebaseClientProvider>
  );
}


'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AuthProvider } from '@/app/auth-provider';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { FirebaseContentWrapper } from '@/components/FirebaseContentWrapper';
import { AppFooter } from '@/components/app-footer';
import { Toaster } from '@/components/ui/toaster';
import { DocuExtractHeader } from '@/components/docu-extract-header';
import { Watermark } from '@/components/watermark';

function DefaultLayout({ children }: { children: ReactNode }) {
    return (
        <div className="relative">
            <div className="relative z-10 flex min-h-screen flex-col">
                <DocuExtractHeader />
                <main className="flex-1">{children}</main>
                <AppFooter />
            </div>
            <Watermark />
        </div>
    );
}

function LoginLayout({ children }: { children: ReactNode }) {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center">
            {children}
        </main>
    );
}

export function Providers({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  return (
    <FirebaseClientProvider>
      <AuthProvider>
        <FirebaseContentWrapper>
            {isLoginPage ? (
                <LoginLayout>{children}</LoginLayout>
            ) : (
                <DefaultLayout>{children}</DefaultLayout>
            )}
          <Toaster />
        </FirebaseContentWrapper>
      </AuthProvider>
    </FirebaseClientProvider>
  );
}

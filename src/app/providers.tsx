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
import { cn } from '@/lib/utils';

export function Providers({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  return (
    <FirebaseClientProvider>
      <AuthProvider>
        <FirebaseContentWrapper>
          <div className="relative">
            <div className="relative z-10 flex min-h-screen flex-col">
              <DocuExtractHeader />
              <main className={cn("flex-1 w-full", isLoginPage && "flex items-center justify-center p-4")}>
                {children}
              </main>
              <AppFooter />
            </div>
            <Watermark />
          </div>
        </FirebaseContentWrapper>
        <Toaster />
      </AuthProvider>
    </FirebaseClientProvider>
  );
}

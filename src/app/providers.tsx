
'use client';

import { ReactNode } from 'react';
import { AuthProvider } from '@/app/auth-provider';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { FirebaseContentWrapper } from '@/components/FirebaseContentWrapper';
import { AppFooter } from '@/components/app-footer';
import { Toaster } from '@/components/ui/toaster';
import { DocuExtractHeader } from '@/components/docu-extract-header';
import { Watermark } from '@/components/watermark';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <FirebaseClientProvider>
      <AuthProvider>
        <FirebaseContentWrapper>
          <div className="relative">
            {/* Main content with a higher z-index */}
            <div className="relative z-10 flex min-h-screen flex-col">
              <DocuExtractHeader />
              <main className="flex-1">{children}</main>
              <AppFooter />
            </div>
            {/* Watermark sits behind the content */}
            <Watermark />
          </div>
          <Toaster />
        </FirebaseContentWrapper>
      </AuthProvider>
    </FirebaseClientProvider>
  );
}

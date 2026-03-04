'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AuthProvider } from '@/app/auth-provider';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { AppFooter } from '@/components/app-footer';
import { Toaster } from '@/components/ui/toaster';
import { DocuExtractHeader } from '@/components/docu-extract-header';
import { Watermark } from '@/components/watermark';
import { cn } from '@/lib/utils';
import { ThemeProvider } from 'next-themes';
import { THEME_SUGGESTIONS } from '@/lib/themes';

export function Providers({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  const allThemes = THEME_SUGGESTIONS.map(t => t.id).concat(['dark', 'system', 'light']);

  return (
    <FirebaseClientProvider>
      <ThemeProvider 
        attribute="class" 
        defaultTheme="light" 
        enableSystem={true}
        themes={allThemes}
      >
        <div className="relative min-h-screen w-full overflow-x-hidden">
          <Watermark />
          <AuthProvider>
              <div className="relative z-10 flex min-h-screen flex-col w-full overflow-x-hidden">
                <DocuExtractHeader />
                <main className={cn("flex-1 w-full", isLoginPage && "flex items-center justify-center p-4")}>
                  {children}
                </main>
                <AppFooter />
              </div>
          </AuthProvider>
        </div>
        <Toaster />
      </ThemeProvider>
    </FirebaseClientProvider>
  );
}

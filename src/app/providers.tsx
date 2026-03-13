'use client';

import { ReactNode, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AuthProvider } from '@/app/auth-provider';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { AppFooter } from '@/components/app-footer';
import { Toaster } from '@/components/ui/toaster';
import { DocuExtractHeader } from '@/components/docu-extract-header';
import { Watermark } from '@/components/watermark';
import { PWABadgeHandler } from '@/components/pwa-badge-handler';
import { cn } from '@/lib/utils';
import { ThemeProvider, useTheme } from 'next-themes';
import { THEME_SUGGESTIONS } from '@/lib/themes';

/**
 * ThemeSync - Ensures '.dark' class matches the selected data-theme metadata.
 */
function ThemeSync() {
  const { theme, resolvedTheme } = useTheme();

  useEffect(() => {
    const activeTheme = THEME_SUGGESTIONS.find(t => t.id === theme);
    const isDark = activeTheme ? activeTheme.isDark : resolvedTheme === 'dark';
    
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme, resolvedTheme]);

  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';
  const allThemes = THEME_SUGGESTIONS.map(t => t.id);

  return (
    <FirebaseClientProvider>
      <ThemeProvider 
        attribute="data-theme" 
        defaultTheme="bms3-a" 
        enableSystem={false}
        storageKey="institutional-theme-persistent-v2"
        themes={allThemes}
        disableTransitionOnChange
      >
        <ThemeSync />
        
        <div className="relative min-h-screen w-full overflow-x-hidden flex flex-col">
          <div className="fixed inset-0 -z-10 flex items-center justify-center pointer-events-none opacity-[0.08] mix-blend-multiply overflow-hidden">
            <Watermark />
          </div>
          
          <AuthProvider>
              <PWABadgeHandler />
              <div className="relative z-10 flex flex-col min-h-screen w-full overflow-x-hidden">
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
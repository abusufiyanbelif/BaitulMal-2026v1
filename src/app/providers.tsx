'use client';

import { ReactNode, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { AuthProvider } from '@/app/auth-provider';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { AppFooter } from '@/components/app-footer';
import { Toaster } from '@/components/ui/toaster';
import { DocuExtractHeader } from '@/components/docu-extract-header';
import { Watermark } from '@/components/watermark';
import { cn } from '@/lib/utils';
import { ThemeProvider } from 'next-themes';

export function Providers({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  const allThemes = Array.from(new Set([
    'light',
    'dark',
    'system',
    'bms3',
    'bmss-brand-warm',
    'ocean-blue',
    'sunset-orange',
    'sunrise-peach',
    'lavender-mint',
    'midnight-ramadan',
    'midnight-emerald',
    'cyberpunk-neon',
    'dracula-orchid',
    'github-dark'
  ]));

  useEffect(() => {
    const applyMotionSettings = () => {
      const animations = localStorage.getItem('app_animations');
      const smoothScroll = localStorage.getItem('app_smooth_scroll');
      const reducedMotion = localStorage.getItem('app_reduced_motion');

      if (animations === 'disabled') {
        document.documentElement.setAttribute('data-animations', 'disabled');
      }
      if (smoothScroll === 'disabled') {
        document.documentElement.setAttribute('data-smooth-scroll', 'disabled');
      } else {
        document.documentElement.setAttribute('data-smooth-scroll', 'enabled');
      }
      if (reducedMotion === 'enabled') {
        document.documentElement.setAttribute('data-motion-reduced', 'enabled');
      }
    };

    applyMotionSettings();
  }, []);

  return (
    <FirebaseClientProvider>
      <ThemeProvider 
        attribute="class" 
        defaultTheme="bms3" 
        enableSystem={true}
        themes={allThemes}
      >
        <div className="relative min-h-screen w-full overflow-x-hidden flex flex-col">
          <div className="fixed inset-0 -z-10 flex items-center justify-center pointer-events-none opacity-[0.03] mix-blend-multiply overflow-hidden">
            <Watermark />
          </div>
          
          <AuthProvider>
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

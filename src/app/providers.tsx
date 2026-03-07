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
import { ThemeProvider, useTheme } from 'next-themes';
import { THEME_SUGGESTIONS } from '@/lib/themes';

/**
 * Internal component to synchronize the 'dark' class with the selected data-theme.
 * This ensures Tailwind's dark: utilities work even when using custom institutional themes.
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

/**
 * Enhanced Providers Component
 * Switched to data-theme attribute to resolve classList.remove errors with spaces.
 */
export function Providers({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  // Extract all valid theme IDs
  const allThemes = THEME_SUGGESTIONS.map(t => t.id);

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
        attribute="data-theme" 
        defaultTheme="bms3-a" 
        enableSystem={false}
        storageKey="institutional-theme-persistent-v2"
        themes={allThemes}
        disableTransitionOnChange
      >
        <ThemeSync />
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

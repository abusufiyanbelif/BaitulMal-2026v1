
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
        <div className="fixed inset-0 z-[-1] flex items-center justify-center pointer-events-none opacity-[0.05]">
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
    const noHeaderFooterRoutes = [] as string[];

    if (noHeaderFooterRoutes.includes(pathname)) {
        return <>{children}</>;
    }

    return (
      <div className="relative flex flex-col min-h-screen">
          <DocuExtractHeader />
          <div className="flex-grow animate-slide-in-from-bottom" style={{ animationDelay: '300ms', animationFillMode: 'backwards' }}>
              {children}
          </div>
          <AppFooter />
      </div>
    );
}


export function Providers({ children }: { children: ReactNode }) {
<<<<<<< Updated upstream
=======
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  // Explicit registry of all institutional palettes to ensure next-themes
  // identifies and persists the correct CSS class instantly.
  const allThemes = Array.from(new Set([
    'light',
    'dark',
    'system',
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

>>>>>>> Stashed changes
  return (
    <FirebaseClientProvider>
      <AuthProvider>
        <FirebaseContentWrapper>
          <div className="app-root relative">
            <Watermark />
            <div className="relative z-10">
              <MainLayout>{children}</MainLayout>
            </div>
          </div>
          <Toaster />
        </FirebaseContentWrapper>
      </AuthProvider>
    </FirebaseClientProvider>
  );
}

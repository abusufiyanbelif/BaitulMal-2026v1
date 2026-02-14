
'use client';

import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect } from 'react';
import { SessionProvider } from '@/components/session-provider';
import { useUser } from '@/firebase';
import { BrandedLoader } from '@/components/branded-loader';

export function AuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading } = useUser();

  const isLoginPage = pathname === '/login';
  const isPublicRoute = isLoginPage || pathname.startsWith('/campaign-public') || pathname.startsWith('/leads-public') || pathname === '/' || pathname === '/seed';

  useEffect(() => {
    if (isLoading) {
      return; // Wait for the auth state to be confirmed
    }

    // If the user is logged in and on ANY public route, redirect to the dashboard.
    if (user && isPublicRoute) {
        router.push('/dashboard');
        return;
    }

    // If we are not on a public route and there is no user, redirect to login.
    if (!isPublicRoute && !user) {
      router.push('/login');
    }

  }, [isLoading, user, isPublicRoute, router, pathname]);

  // Show a loader in two scenarios:
  // 1. On initial load of a private page while auth state is being determined.
  // 2. After logout on a private page, to prevent a flash of empty content while redirecting to login.
  const showLoader = (isLoading && !isPublicRoute) || (!isLoading && !user && !isPublicRoute);
  
  if (showLoader) {
    return <BrandedLoader />;
  }
  
  // Render the session provider and children.
  return (
    <SessionProvider authUser={user}>
        {children}
    </SessionProvider>
  );
}

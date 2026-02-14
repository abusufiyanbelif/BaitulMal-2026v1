
'use client';

import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect } from 'react';
import { SessionProvider } from '@/components/session-provider';
import { useUser } from '@/firebase';
import { BrandedLoader } from '@/components/branded-loader';

function AuthGuard({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { user, isLoading } = useUser(); // isLoading will be false here from the parent component

    const isLoginPage = pathname === '/login';
    const isPublicRoute = isLoginPage || pathname.startsWith('/campaign-public') || pathname.startsWith('/leads-public') || pathname === '/' || pathname === '/seed';

    useEffect(() => {
        // This effect will run after the initial render, when isLoading is guaranteed to be false.
        if (!isLoading && !isPublicRoute && !user) {
            router.push('/login');
        }
    }, [isLoading, user, isPublicRoute, router]);

    // While the redirect is in-flight for a private route, show a loader
    // This prevents any of the children from attempting to render.
    if (!isPublicRoute && !user) {
        return <BrandedLoader />;
    }

    // The user is authenticated, or the route is public, so render the app.
    return (
        <SessionProvider authUser={user}>
            {children}
        </SessionProvider>
    );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isLoading } = useUser();

  // This is the initial loading gate. It waits for onAuthStateChanged to fire at least once.
  // Nothing else in the app will render until this is complete.
  if (isLoading) {
    return <BrandedLoader />;
  }
  
  // Once the initial auth state is known, delegate to the AuthGuard for routing logic.
  return (
    <AuthGuard>
        {children}
    </AuthGuard>
  );
}

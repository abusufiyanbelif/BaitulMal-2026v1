
'use client';

import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect } from 'react';
import { SessionProvider } from '@/components/session-provider';
import { useUser } from '@/firebase/auth/use-user';
import { useSession } from '@/hooks/use-session';
import { BrandedLoader } from '@/components/branded-loader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

// This internal component will only run AFTER the initial auth check is complete.
// It handles route protection.
function RouteGuard({ children }: { children: ReactNode }) {
    const { user, isLoading } = useSession(); // Use session which knows about both auth and profile loading state
    const router = useRouter();
    const pathname = usePathname();

    const isPublicRoute = ['/login', '/seed'].includes(pathname) || pathname.startsWith('/campaign-public') || pathname.startsWith('/leads-public') || pathname.startsWith('/info');
    const isHomePage = pathname === '/';

    useEffect(() => {
        // Wait until the session loading is complete before running any redirect logic
        if (isLoading) {
            return;
        }
        
        if (!user && !isPublicRoute && !isHomePage) {
            router.push('/login');
        }
        if (user && isHomePage) {
            router.push('/dashboard');
        }
    }, [user, isLoading, isPublicRoute, isHomePage, pathname, router]);

    // Show a loader while the session is loading OR while a redirect is imminent.
    if (isLoading || (!user && !isPublicRoute && !isHomePage) || (user && isHomePage)) {
        return <BrandedLoader />;
    }
    
    // If the route is public, or the user is authenticated and on a non-root page, render the children.
    return <>{children}</>;
}


export function AuthProvider({ children }: { children: ReactNode }) {
    const { user, isUserLoading, userError } = useUser();

    if (userError) {
        return (
             <div className="flex flex-col items-center justify-center min-h-screen p-4">
                <Card className="w-full max-w-lg">
                    <CardHeader className="text-center">
                        <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
                        <CardTitle className="text-destructive">Application Error</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                         <Alert variant="destructive">
                            <AlertTitle>An error occurred while connecting to services.</AlertTitle>
                            <AlertDescription>
                                <p>This can happen due to network issues or a misconfiguration.</p>
                                <p className="font-mono text-xs bg-destructive/20 p-2 rounded mt-2">
                                    {userError.message}
                                </p>
                            </AlertDescription>
                        </Alert>
                        <Button onClick={() => window.location.reload()} className="w-full">
                            Reload Page
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }
    
    // SessionProvider fetches the user's profile and provides a unified 'isLoading' state.
    // RouteGuard consumes this state to prevent premature redirects.
    return (
        <SessionProvider authUser={user} isAuthenticating={isUserLoading}>
            <RouteGuard>{children}</RouteGuard>
        </SessionProvider>
    );
}

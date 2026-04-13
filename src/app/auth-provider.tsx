'use client';

import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { SessionProvider } from '@/components/session-provider';
import { useUser } from '@/firebase/auth/use-user';
import { useSession } from '@/hooks/use-session';
import { BrandedLoader } from '@/components/branded-loader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

/**
 * RouteGuard - Optimized for multi-role identity navigation.
 * Ensures Staff see the dashboard first, while Donors are routed to their portal.
 */
function RouteGuard({ children }: { children: ReactNode }) {
    const { user, userProfile, isLoading, isStaff } = useSession();
    const router = useRouter();
    const pathname = usePathname();
    const [isRedirecting, setIsRedirecting] = useState(false);

    const isPublicRoute = ['/login', '/seed', '/', '/portal-login'].includes(pathname) || 
                          pathname.startsWith('/campaign-public') || 
                          pathname.startsWith('/leads-public') || 
                          pathname.startsWith('/info');

    useEffect(() => {
        if (isLoading) return;
        
        // If logged in and at login page, redirect to primary dashboard
        if (user && (pathname === '/login' || pathname === '/portal-login')) {
            setIsRedirecting(true);
            router.push(isStaff ? '/dashboard' : '/donor-portal');
            return;
        }

        // Redirect guests away from private routes
        if (!user && !isPublicRoute) {
            setIsRedirecting(true);
            router.push('/login');
            return;
        }
        
        // Handle landing page redirection for logged-in users
        if (user && pathname === '/') {
            setIsRedirecting(true);
            router.push(isStaff ? '/dashboard' : '/donor-portal');
            return;
        }

        setIsRedirecting(false);
    }, [user, isLoading, isPublicRoute, pathname, router, isStaff]);

    if (isPublicRoute && !isRedirecting) {
        return <>{children}</>;
    }

    if (isLoading || isRedirecting) {
        return <BrandedLoader message="Synchronizing Access Controls..." />;
    }
    
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
                        <CardTitle className="text-destructive">Service Error</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 font-normal text-primary">
                         <Alert variant="destructive">
                            <AlertTitle className="font-bold">Could Not Synchronize With Authorization Server</AlertTitle>
                            <AlertDescription>
                                <p>This May Be Due To A Network Interruption. Please Verify Your Connectivity.</p>
                                <p className="font-mono text-[10px] bg-destructive/10 p-2 rounded mt-2 opacity-70">
                                    {userError.message}
                                </p>
                            </AlertDescription>
                        </Alert>
                        <Button onClick={() => window.location.reload()} className="w-full font-bold">
                            Reload Organization Dashboard
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }
    
    return (
        <SessionProvider authUser={user} isAuthenticating={isUserLoading}>
            <RouteGuard>{children}</RouteGuard>
        </SessionProvider>
    );
}
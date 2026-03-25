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
 * RouteGuard - Optimized for rapid initial mount.
 * Prevents long blocking states by allowing public views to render immediately.
 */
function RouteGuard({ children }: { children: ReactNode }) {
    const { user, isLoading } = useSession();
    const router = useRouter();
    const pathname = usePathname();
    const [isRedirecting, setIsRedirecting] = useState(false);

    const isPublicRoute = ['/login', '/seed', '/'].includes(pathname) || 
                          pathname.startsWith('/campaign-public') || 
                          pathname.startsWith('/leads-public') || 
                          pathname.startsWith('/info');

    useEffect(() => {
        if (isLoading) return;
        
        if (user && pathname === '/login') {
            setIsRedirecting(true);
            router.push('/dashboard');
            return;
        }

        if (!user && !isPublicRoute) {
            setIsRedirecting(true);
            router.push('/login');
            return;
        }
        
        if (user && pathname === '/') {
            setIsRedirecting(true);
            router.push('/dashboard');
            return;
        }

        setIsRedirecting(false);
    }, [user, isLoading, isPublicRoute, pathname, router]);

    // Fast return for public routes to ensure snappy first paint
    if (isPublicRoute && !isRedirecting) {
        return <>{children}</>;
    }

    // Only show the blocking loader if we are truly waiting for session OR in the middle of a private redirect.
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
                    <CardContent className="space-y-4 font-normal">
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

'use client';

import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect } from 'react';
import { SessionProvider } from '@/components/session-provider';
import { useUser } from '@/firebase/auth/use-user';
import { BrandedLoader } from '@/components/branded-loader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

// This internal component will only run AFTER the initial auth check is complete.
// It handles route protection.
function RouteGuard({ children }: { children: ReactNode }) {
    const { user } = useUser(); // We can safely get the user now.
    const router = useRouter();
    const pathname = usePathname();

    const isPublicRoute = ['/', '/login', '/seed'].includes(pathname) || pathname.startsWith('/campaign-public') || pathname.startsWith('/leads-public') || pathname.startsWith('/info');

    useEffect(() => {
        // This effect will now run with a stable `user` value.
        if (!user && !isPublicRoute) {
            router.push('/login');
        }
    }, [user, isPublicRoute, pathname, router]);

    // While the redirect is happening for a protected route, show a loader.
    if (!user && !isPublicRoute) {
        return <BrandedLoader />;
    }
    
    // If the route is public, or the user is authenticated, render the children.
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

    if (isUserLoading) {
        return <BrandedLoader />;
    }
    
    // Once loading is complete, we provide the session and then guard the routes.
    return (
        <SessionProvider authUser={user}>
            <RouteGuard>{children}</RouteGuard>
        </SessionProvider>
    );
}

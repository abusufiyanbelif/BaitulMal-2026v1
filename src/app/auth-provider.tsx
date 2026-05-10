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
import { AlertTriangle, LogOut } from 'lucide-react';
import { useFirestore, useMemoFirebase, useDoc, doc, useAuth } from '@/firebase';
import { signOut } from 'firebase/auth';

/**
 * RouteGuard - Optimized for multi-role identity navigation.
 * Ensures Staff see the dashboard first, while Donors are routed to their portal.
 */
function RouteGuard({ children }: { children: ReactNode }) {
    const { user, userProfile, isLoading, isStaff } = useSession();
    const router = useRouter();
    const pathname = usePathname();
    const [isRedirecting, setIsRedirecting] = useState(false);
    const firestore = useFirestore();
    const auth = useAuth();

    const donorConfigRef = useMemoFirebase(() => (firestore) ? doc(firestore, 'settings', 'donor_config') : null, [firestore]);
    const beneficiaryConfigRef = useMemoFirebase(() => (firestore) ? doc(firestore, 'settings', 'beneficiary_config') : null, [firestore]);
    const userConfigRef = useMemoFirebase(() => (firestore) ? doc(firestore, 'settings', 'user_config') : null, [firestore]);
    
    const { data: donorConfig } = useDoc<any>(donorConfigRef);
    const { data: beneficiaryConfig } = useDoc<any>(beneficiaryConfigRef);
    const { data: userConfig } = useDoc<any>(userConfigRef);

    // 4. Specific Session Revocation Listener (Real-time document watch)
    const sessionId = typeof window !== 'undefined' ? localStorage.getItem('portal_session_id') : null;
    const sessionRef = useMemoFirebase(() => (firestore && sessionId) ? doc(firestore, 'user_sessions', sessionId) : null, [firestore, sessionId]);
    const { data: sessionData } = useDoc<any>(sessionRef);

    const isPublicRoute = ['/login', '/seed', '/', '/portal-login', '/portal-register', '/donate', '/campaign-public', '/leads-public'].includes(pathname) || 
                          pathname.startsWith('/campaign-public/') || 
                          pathname.startsWith('/leads-public/') || 
                          pathname.startsWith('/info/') ||
                          pathname.startsWith('/public/');

    useEffect(() => {
        if (isLoading) return;
        
        const isPortalPath = pathname.startsWith('/donor-portal') || pathname.startsWith('/beneficiary-portal');
        const isStaffPath = [
            '/dashboard', '/users', '/settings', '/analytics', '/messages',
            '/audit', '/diagnostics', '/verifications', '/donors', '/donations',
            '/beneficiaries', '/campaigns', '/leads-members', '/campaign-members',
            '/extractor', '/story-creator'
        ].some(p => pathname.startsWith(p));

        // 1. Authenticated User at a Login/Root Page → redirect to their home
        if (user && (pathname === '/login' || pathname === '/portal-login' || pathname === '/')) {
            setIsRedirecting(true);
            if (isStaff) {
                router.push('/dashboard');
            } else if (userProfile?.role === 'Beneficiary') {
                router.push('/beneficiary-portal');
            } else if (userProfile?.role === 'Donor') {
                router.push('/donor-portal');
            } else if (userProfile === null) {
                // Profile not found in 'users' collection — may be a portal-only user
                // (their profile lives in 'donors' or 'beneficiaries' collection).
                // Use localStorage role as a tiebreaker to avoid spurious sign-outs.
                const storedRole = typeof window !== 'undefined' ? localStorage.getItem('portal_role') : null;
                if (storedRole === 'Donor') {
                    router.push('/donor-portal');
                } else if (storedRole === 'Beneficiary') {
                    router.push('/beneficiary-portal');
                } else {
                    // Genuinely unidentified — clear stale session
                    console.warn("RouteGuard: Authenticated user has no profile or identifiable role. Clearing session.");
                    signOut(auth).then(() => {
                        setIsRedirecting(false);
                        router.push('/portal-login');
                    });
                }
            } else {
                // Profile exists but role is not Staff/Donor/Beneficiary (e.g. legacy data)
                setIsRedirecting(false);
            }
            return;
        }

        // 2. Guest User trying to access Private Routes
        if (!user && !isPublicRoute) {
            setIsRedirecting(true);
            const callbackParam = pathname !== '/' ? `?callbackUrl=${encodeURIComponent(pathname)}` : '';
            
            // Contextual redirection: Send to correct login page based on the attempted path
            if (isPortalPath) {
                router.push(`/portal-login${callbackParam}`);
            } else {
                router.push(`/login${callbackParam}`);
            }
            return;
        }
        
        // 3. Role-based cross-access protection (Prevent Donors from seeing Staff pages and vice versa)
        if (user && !isLoading) {
            if (isStaffPath && !isStaff) {
                setIsRedirecting(true);
                // Portal users trying to access staff pages → redirect to their portal
                const storedRole = typeof window !== 'undefined' ? localStorage.getItem('portal_role') : null;
                if (storedRole === 'Beneficiary' || userProfile?.role === 'Beneficiary') {
                    router.push('/beneficiary-portal');
                } else {
                    router.push('/donor-portal');
                }
                return;
            }
            if (isPortalPath && isStaff) {
                // Staff can view portals (usually for testing); allow access.
            }
        }

        setIsRedirecting(false);
    }, [user, userProfile, isLoading, isPublicRoute, pathname, router, isStaff]);

    // 4. Session Revocation Listener (Instant Logout)
    useEffect(() => {
        if (!user || isLoading || !auth) return;
        
        const sessionStartStr = localStorage.getItem('portal_session_start');
        // If missing, we treat it as an 'old' session (pre-revocation tracking) and set to 0 to trigger revocation check
        const sessionStart = sessionStartStr ? parseInt(sessionStartStr) : 0;
        
        const config = userProfile?.role === 'Donor' ? donorConfig : 
                       (userProfile?.role === 'Beneficiary' ? beneficiaryConfig : 
                       (isStaff ? userConfig : null));
        
        const revokedAt = (config && typeof config.sessionRevokedAt === 'number') ? config.sessionRevokedAt : (config?.sessionRevokedAt?.toMillis ? config.sessionRevokedAt.toMillis() : 0);
        
        // 5. Individual User Revocation (e.g. after password reset or manual "Close All Sessions")
        const userRevokedAt = (userProfile && typeof userProfile.forceLogoutAt === 'number') ? userProfile.forceLogoutAt : (userProfile?.forceLogoutAt?.toMillis ? userProfile.forceLogoutAt.toMillis() : 0);
        
        const maxRevocationTime = Math.max(revokedAt, userRevokedAt);

        if (sessionStart > 0 && maxRevocationTime > sessionStart) {
            console.warn("Session revocation detected by administrative or user security action.");
            localStorage.removeItem('portal_session_start');
            localStorage.removeItem('portal_session_id');
            signOut(auth).then(() => {
                const targetPath = isStaff ? '/login?revoked=true' : '/portal-login?revoked=true';
                router.push(targetPath);
            });
        }
    }, [user, userProfile, donorConfig, beneficiaryConfig, userConfig, isLoading, auth, router, isStaff]);

    // 6. Handle Specific Session Revocation (from sessionData listener)
    useEffect(() => {
        if (sessionData?.status === 'Revoked' && auth) {
            console.warn("Current session has been explicitly revoked via security settings.");
            localStorage.removeItem('portal_session_start');
            localStorage.removeItem('portal_session_id');
            signOut(auth).then(() => {
                const targetPath = isStaff ? '/login?revoked=true' : '/portal-login?revoked=true';
                router.push(targetPath);
            });
        }
    }, [sessionData, auth, router, isStaff]);

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
'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useSession } from '@/hooks/use-session';

export function ClientLogger() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { userProfile } = useSession();

    useEffect(() => {
        const logInteraction = async () => {
            const url = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
            const message = `Page View: ${url}`;
            
            try {
                await fetch('/api/logs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        level: 'info',
                        message,
                        profile: userProfile?.role || 'Public',
                        metadata: {
                            url,
                            pathname,
                            role: userProfile?.role,
                            userId: userProfile?.uid,
                        }
                    })
                });
            } catch (e) {
                // Silently fail to not interrupt user experience
                console.error('Failed to log client interaction:', e);
            }
        };

        logInteraction();
    }, [pathname, searchParams, userProfile]);

    useEffect(() => {
        const handleError = async (event: ErrorEvent) => {
            try {
                await fetch('/api/logs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        level: 'error',
                        message: `Client Error: ${event.message}`,
                        profile: userProfile?.role || 'Public',
                        metadata: {
                            stack: event.error?.stack,
                            filename: event.filename,
                            lineno: event.lineno,
                            colno: event.colno,
                            url: window.location.href,
                        }
                    })
                });
            } catch (e) {}
        };

        window.addEventListener('error', handleError);
        return () => window.removeEventListener('error', handleError);
    }, [userProfile]);

    return null;
}

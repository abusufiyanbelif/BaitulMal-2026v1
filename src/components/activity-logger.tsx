'use client';

import React, { useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useLogger } from '@/hooks/use-logger';

function LoggerInner() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { info, error } = useLogger();

    useEffect(() => {
        // Log page navigation
        const url = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
        info(`Navigation: ${url}`, { type: 'page_view' });
    }, [pathname, searchParams, info]);

    useEffect(() => {
        // Log startup/reload
        info('Application Session Started/Reloaded', { type: 'session_start' });
        
        // Log visibility changes
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                info('Application Tab Focused', { type: 'focus' });
            } else {
                info('Application Tab Blurred', { type: 'blur' });
            }
        };

        // Capture global errors
        const handleError = (event: ErrorEvent) => {
            error(`Global Error: ${event.message}`, {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error?.stack
            });
        };

        const handleRejection = (event: PromiseRejectionEvent) => {
            error(`Unhandled Promise Rejection: ${event.reason}`, {
                reason: event.reason
            });
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handleRejection);
        
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('error', handleError);
            window.removeEventListener('unhandledrejection', handleRejection);
        };
    }, [info, error]);

    return null;
}

export function ActivityLogger() {
    return (
        <Suspense fallback={null}>
            <LoggerInner />
        </Suspense>
    );
}

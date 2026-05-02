'use client';

import React, { useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useLogger } from '@/hooks/use-logger';

function LoggerInner() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { info } = useLogger();

    useEffect(() => {
        // Log page navigation
        const url = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
        info(`Navigation: ${url}`, { type: 'page_view' });
    }, [pathname, searchParams, info]);

    useEffect(() => {
        // Log startup/reload
        info('Application Session Started/Reloaded', { type: 'session_start' });
        
        // Log visibility changes (e.g. user switching tabs)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                info('Application Tab Focused', { type: 'focus' });
            } else {
                info('Application Tab Blurred', { type: 'blur' });
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [info]);

    return null;
}

export function ActivityLogger() {
    return (
        <Suspense fallback={null}>
            <LoggerInner />
        </Suspense>
    );
}

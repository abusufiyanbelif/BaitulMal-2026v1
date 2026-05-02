'use client';

import { useCallback } from 'react';
import { useSession } from './use-session';

export function useLogger() {
    const { user, userProfile } = useSession();
    const profile = userProfile?.role || 'guest';

    const log = useCallback(async (level: 'info' | 'warn' | 'error', message: string, metadata: any = {}) => {
        try {
            await fetch('/api/logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    level,
                    message,
                    metadata: {
                        ...metadata,
                        url: window.location.href,
                        path: window.location.pathname,
                        userId: user?.uid || 'guest'
                    },
                    profile
                })
            });
        } catch (e) {
            console.error('Logging failed:', e);
        }
    }, [profile, user, userProfile]);

    return {
        info: (msg: string, meta?: any) => log('info', msg, meta),
        warn: (msg: string, meta?: any) => log('warn', msg, meta),
        error: (msg: string, meta?: any) => log('error', msg, meta)
    };
}

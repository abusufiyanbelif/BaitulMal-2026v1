'use client';

import { useEffect } from 'react';
import { incrementPageHit } from '@/app/analytics/actions';

export function usePageHit(pageId: string) {
    useEffect(() => {
        if (pageId) {
            // Don't await, just fire and forget
            incrementPageHit(pageId);
        }
    }, [pageId]);
}


'use client';

import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { ResourceSettings } from '@/lib/types';

export function useResourceConfig() {
    const firestore = useFirestore();
    const configRef = useMemoFirebase(() => 
        firestore ? doc(firestore, 'settings', 'resources') : null, 
    [firestore]);

    const { data, isLoading, error } = useDoc<ResourceSettings>(configRef);

    return {
        resourceSettings: data,
        isLoading,
        error
    };
}

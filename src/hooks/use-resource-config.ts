'use client';

import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { ResourceSettings } from '@/lib/types';
import { useSession } from '@/hooks/use-session';

export function useResourceConfig() {
    const firestore = useFirestore();
    const { user } = useSession();

    const configRef = useMemoFirebase(() => 
        (firestore && user) ? doc(firestore, 'settings', 'resources') : null, 
    [firestore, user]);

    const { data, isLoading, error } = useDoc<ResourceSettings>(configRef);

    return {
        resourceSettings: data as ResourceSettings | null,
        isLoading: user ? isLoading : false,
        error: user ? error : null
    };
}

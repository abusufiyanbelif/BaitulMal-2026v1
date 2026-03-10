'use client';
import { useMemoFirebase, useFirestore, useDoc, doc, type DocumentReference } from '@/firebase';
import type { GuidanceData } from '@/lib/types';

export function useGuidance() {
  const firestore = useFirestore();

  const docRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'settings', 'guidance') as DocumentReference<GuidanceData>;
  }, [firestore]);

  const { data, isLoading, error, forceRefetch } = useDoc<GuidanceData>(docRef);

  return { 
    guidanceData: data, 
    isLoading, 
    error,
    forceRefetch
  };
}

'use client';
import { useMemoFirebase, useFirestore, useDoc, doc, type DocumentReference } from '@/firebase';
import type { GuidingPrinciplesData } from '@/lib/types';

export function useGuidingPrinciples() {
  const firestore = useFirestore();

  const docRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'settings', 'guidingPrinciples') as DocumentReference<GuidingPrinciplesData>;
  }, [firestore]);

  const { data, isLoading, error, forceRefetch } = useDoc<GuidingPrinciplesData>(docRef);

  return { 
    guidingPrinciplesData: data, 
    isLoading, 
    error,
    forceRefetch
  };
}



'use client';
import { useMemoFirebase, useFirestore, useDoc, doc, type DocumentReference } from '@/firebase';
import type { DonationInfoData } from '@/lib/types';

export function useDonationInfo() {
  const firestore = useFirestore();

  const docRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'settings', 'donationInfo') as DocumentReference<DonationInfoData>;
  }, [firestore]);

  const { data, isLoading, error, forceRefetch } = useDoc<DonationInfoData>(docRef);

  return { 
    donationInfoData: data, 
    isLoading, 
    error,
    forceRefetch
  };
}

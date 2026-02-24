

'use client';
import { useMemoFirebase, useFirestore, useDoc, doc, type DocumentReference } from '@/firebase';
import type { InfoSettings } from '@/lib/types';

export function useInfoSettings() {
  const firestore = useFirestore();

  const infoSettingsDocRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'settings', 'info') as DocumentReference<InfoSettings>;
  }, [firestore]);

  const { data: infoSettings, isLoading, error } = useDoc<InfoSettings>(infoSettingsDocRef);

  return { 
    infoSettings, 
    isLoading, 
    error,
  };
}

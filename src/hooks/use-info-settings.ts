
'use client';
import { useMemoFirebase, useFirestore } from '@/firebase/provider';
import { useDoc } from '@/firebase/firestore/use-doc';
import { doc, DocumentReference } from 'firebase/firestore';
import type { InfoSettings } from '@/lib/types';

export function useInfoSettings() {
  const firestore = useFirestore();

  const infoSettingsDocRef = useMemoFirebase(() => {
    if (!firestore) {
      return null;
    }
    return doc(firestore, 'settings', 'info') as DocumentReference<InfoSettings>;
  }, [firestore]);

  const { data: infoSettings, isLoading, error } = useDoc<InfoSettings>(infoSettingsDocRef);

  return { 
    infoSettings, 
    isLoading, 
    error,
  };
}

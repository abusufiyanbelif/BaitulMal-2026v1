

'use client';
import { useMemoFirebase, useFirestore } from '@/firebase/provider';
import { useDoc } from '@/firebase/firestore/use-doc';
import { doc, type DocumentReference } from '@/firebase';
import type { BrandingSettings } from '@/lib/types';

export function useBranding() {
  const firestore = useFirestore();

  const brandingDocRef = useMemoFirebase(() => {
    if (!firestore) {
      return null;
    }
    return doc(firestore, 'settings', 'branding') as DocumentReference<BrandingSettings>;
  }, [firestore]);

  const { data: brandingSettings, isLoading: isBrandingLoading, error } = useDoc<BrandingSettings>(brandingDocRef);

  return { 
    brandingSettings, 
    isLoading: isBrandingLoading, 
    error,
  };
}

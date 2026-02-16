
'use client';
import { useMemoFirebase, useFirestore } from '@/firebase/provider';
import { useDoc } from '@/firebase/firestore/use-doc';
import { doc, DocumentReference } from 'firebase/firestore';
import type { PaymentSettings } from '@/lib/types';

export function usePaymentSettings() {
  const firestore = useFirestore();

  const paymentSettingsDocRef = useMemoFirebase(() => {
    if (!firestore) {
      return null;
    }
    return doc(firestore, 'settings', 'payment') as DocumentReference<PaymentSettings>;
  }, [firestore]);

  const { data: paymentSettings, isLoading, error } = useDoc<PaymentSettings>(paymentSettingsDocRef);

  return { 
    paymentSettings, 
    isLoading, 
    error,
  };
}

    

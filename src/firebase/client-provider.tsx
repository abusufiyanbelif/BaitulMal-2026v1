'use client';

import React, { useMemo, type ReactNode } from 'react';
import { FirebaseProvider } from './provider'; // Use relative import to break circularity
import { initializeFirebase } from './init'; // Use relative import to break circularity

interface FirebaseClientProviderProps {
  children: ReactNode;
}

/**
 * FirebaseClientProvider - Initializes the Firebase SDKs on the client side only.
 * Composes the FirebaseProvider with live service instances.
 */
export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const firebaseServices = useMemo(() => {
    return initializeFirebase();
  }, []);

  return (
    <FirebaseProvider
      firebaseApp={firebaseServices.firebaseApp}
      auth={firebaseServices.auth}
      firestore={firebaseServices.firestore}
      storage={firebaseServices.storage}
    >
      {children}
    </FirebaseProvider>
  );
}

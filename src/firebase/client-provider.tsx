'use client';

import React, { useState, useEffect, type ReactNode } from 'react';
import { FirebaseProvider, type FirebaseContextState } from '@/firebase/provider';
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

// Logic from client-init.ts is now here
function initializeFirebaseClient(): {
    firebaseApp: FirebaseApp;
    auth: Auth;
    firestore: Firestore;
    storage: FirebaseStorage;
} {
  if (typeof window === 'undefined') {
    throw new Error('Firebase client called on server');
  }

  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  };

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

  return {
    firebaseApp: app,
    auth: getAuth(app),
    firestore: getFirestore(app),
    storage: getStorage(app),
  };
}


interface FirebaseClientProviderProps {
  children: ReactNode;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const [contextValue, setContextValue] = useState<FirebaseContextState>({
    firebaseApp: null,
    auth: null,
    firestore: null,
    storage: null,
    initializationError: null,
  });

  useEffect(() => {
    try {
      // Call the local function now
      const { firebaseApp, auth, firestore, storage } = initializeFirebaseClient();
      setContextValue({
        firebaseApp,
        auth,
        firestore,
        storage,
        initializationError: null,
      });
    } catch (error: any) {
      console.error("Firebase initialization failed:", error);
      setContextValue({
        firebaseApp: null,
        auth: null,
        firestore: null,
        storage: null,
        initializationError: error,
      });
    }
  }, []);

  return (
    <FirebaseProvider value={contextValue}>
      {children}
    </FirebaseProvider>
  );
}

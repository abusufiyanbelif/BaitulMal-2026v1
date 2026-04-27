'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging } from 'firebase/messaging';

/**
 * @fileOverview Base initialization for Firebase SDKs.
 * Isolated from the barrel file to prevent circular dependencies.
 */
export function initializeFirebase() {
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  const firestore = getFirestore(app);

  if (typeof window !== 'undefined') {
    enableIndexedDbPersistence(firestore).catch((err) => {
      console.warn('Firestore persistence failed:', err.code);
    });
  }

  return {
    firebaseApp: app,
    auth: getAuth(app),
    firestore,
    storage: getStorage(app),
    messaging: typeof window !== 'undefined' ? getMessaging(app) : null
  };
}
'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentSingleTabManager 
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging } from 'firebase/messaging';

/**
 * @fileOverview Base initialization for Firebase SDKs.
 * Optimized for v10+ with persistent local cache for mobile sync.
 */
let firestoreInstance: any = null;

export function initializeFirebase() {
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  
  // Use a singleton for Firestore to prevent "already started" errors
  if (!firestoreInstance) {
    if (typeof window !== 'undefined') {
      try {
        // Modern v10 way to enable persistence with multi-tab support
        firestoreInstance = initializeFirestore(app, {
          localCache: persistentLocalCache({
            tabManager: persistentSingleTabManager()
          })
        });
        console.log('Firestore Persistence Initialized (v10)');
      } catch (e) {
        console.warn('Firestore failed to initialize with cache, falling back to default:', e);
        firestoreInstance = getFirestore(app);
      }
    } else {
      firestoreInstance = getFirestore(app);
    }
  }

  return {
    firebaseApp: app,
    auth: getAuth(app),
    firestore: firestoreInstance,
    storage: getStorage(app),
    messaging: typeof window !== 'undefined' ? getMessaging(app) : null
  };
}
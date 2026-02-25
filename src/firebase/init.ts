
// src/firebase/init.ts
import { initializeApp, getApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { firebaseConfig } from './config';

interface FirebaseServices {
  firebaseApp: FirebaseApp;
  auth: Auth;
  firestore: Firestore | null;
  storage: FirebaseStorage | null;
}

let firebaseServices: FirebaseServices | null = null;

export function initializeFirebase(): FirebaseServices {
  if (typeof window === 'undefined') {
    // On the server, we don't want to initialize Firebase client SDK.
    // We return a "null" version of the services.
    // Components should be robust enough to handle this.
    console.warn("Firebase client SDK cannot be initialized on the server. This is expected during SSR.");
    // This is not a real Firebase App, but it satisfies the type for the server.
    const mockApp = { name: 'mock', options: {}, automaticDataCollectionEnabled: false };
    return {
        firebaseApp: mockApp as FirebaseApp,
        auth: {} as Auth,
        firestore: null,
        storage: null
    };
  }

  if (firebaseServices) {
    return firebaseServices;
  }

  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  
  let firestore: Firestore | null = null;
  let storage: FirebaseStorage | null = null;
  
  // Explicitly check for projectId before initializing Firestore
  if (firebaseConfig.projectId) {
    try {
      firestore = getFirestore(app);
    } catch (e: any) {
      console.error('Firestore initialization failed despite having a projectId:', e);
      // In case of other errors during init
    }
  } else {
    console.warn('Firestore is not configured. Missing NEXT_PUBLIC_FIREBASE_PROJECT_ID. Firestore-related features will be disabled.');
  }

  // Explicitly check for storageBucket before initializing Storage
  if (firebaseConfig.storageBucket) {
    try {
      storage = getStorage(app);
    } catch (e: any) {
      console.error('Storage initialization failed despite having a storageBucket:', e);
    }
  } else {
    console.warn('Firebase Storage is not configured. Missing NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET. Storage-related features will be disabled.');
  }

  firebaseServices = {
    firebaseApp: app,
    auth: getAuth(app),
    firestore,
    storage,
  };

  return firebaseServices;
}

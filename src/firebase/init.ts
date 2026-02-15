// src/firebase/init.ts
import { FirebaseApp, initializeApp, getApp, getApps } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import { FirebaseStorage, getStorage } from 'firebase/storage';
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
    // This function should only be called on the client.
    // We'll throw an error to make it clear during development.
    throw new Error("Firebase cannot be initialized on the server.");
  }

  if (firebaseServices) {
    return firebaseServices;
  }

  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  
  let firestore: Firestore | null = null;
  let storage: FirebaseStorage | null = null;
  
  try {
    firestore = getFirestore(app);
  } catch (e: any) {
    console.warn('Firestore initialization failed:', e);
  }

  try {
    storage = getStorage(app);
  } catch (e: any) {
    console.warn('Storage initialization failed:', e);
  }

  firebaseServices = {
    firebaseApp: app,
    auth: getAuth(app),
    firestore,
    storage,
  };

  return firebaseServices;
}

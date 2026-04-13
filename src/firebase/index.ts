'use client';

/**
 * @fileOverview Definitive barrel file for Firebase SDKs.
 * Re-engineered to prevent circular dependencies by exporting core functions first.
 */

// 1. Explicitly export all core Firestore SDK functions
export {
    doc,
    collection,
    query,
    where,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    deleteField,
    Timestamp,
    increment,
    writeBatch,
    orderBy,
    limit,
    onSnapshot
} from 'firebase/firestore';

// 2. Explicitly export all core Auth SDK functions
export {
    signInWithPhoneNumber,
    RecaptchaVerifier,
    sendPasswordResetEmail,
    onAuthStateChanged,
    signOut as firebaseSignOut,
    getAuth
} from 'firebase/auth';

// 3. Explicitly export Storage functions
export {
    ref as storageRef,
    uploadBytes,
    getDownloadURL,
    getStorage,
    deleteObject,
    uploadString
} from 'firebase/storage';

// 4. Export local provider and hooks
export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';

// 5. Initialization logic (Idempotent)
import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth as getFirebaseAuth } from 'firebase/auth';
import { getFirestore as getFirebaseFirestore } from 'firebase/firestore';
import { getStorage as getFirebaseStorage } from 'firebase/storage';

export function initializeFirebase() {
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  return {
    firebaseApp: app,
    auth: getFirebaseAuth(app),
    firestore: getFirebaseFirestore(app),
    storage: getFirebaseStorage(app),
  };
}
'use client';

// 1. Export core SDK functions first to ensure they are available to sub-modules.
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

export {
    ref as storageRef,
    uploadBytes,
    getDownloadURL,
    getStorage,
    deleteObject,
    uploadString
} from 'firebase/storage';

export {
    signInWithPhoneNumber,
    RecaptchaVerifier,
    sendPasswordResetEmail,
    onAuthStateChanged,
    signOut as firebaseSignOut,
    getAuth
} from 'firebase/auth';

// 2. Export local files
export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';

// 3. Initialization Logic
import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

export function initializeFirebase() {
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  return {
    firebaseApp: app,
    auth: getAuth(app),
    firestore: getFirestore(app),
    storage: getStorage(app),
  };
}
